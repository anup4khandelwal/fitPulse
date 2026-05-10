import { NextRequest, NextResponse } from "next/server";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { getFitbitEnv } from "@/lib/env";
import { fitbitFetch } from "@/lib/fitbit/client";
import { prisma } from "@/lib/prisma";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in?: number;
  scope: string;
  token_type: "Bearer";
};

type HealthIdentityResponse = {
  name: string;
  legacyUserId: string;
  healthUserId: string;
};

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("fitbit_oauth_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.json({ error: "Invalid OAuth state/code" }, { status: 400 });
  }

  const { clientId, clientSecret, redirectUri } = getFitbitEnv();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "Google token exchange failed" }, { status: 400 });
  }

  const tokenJson = (await tokenResponse.json()) as GoogleTokenResponse;

  const identityRes = await fitbitFetch(tokenJson.access_token, "/v4/users/me/identity");
  const identity = identityRes.ok ? ((await identityRes.json()) as HealthIdentityResponse) : null;

  const user = await getOrCreateSingleUser();

  if (identity?.legacyUserId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { fitbitUserId: identity.legacyUserId },
    });
  }

  await prisma.fitbitAuth.upsert({
    where: { userId: user.id },
    update: {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      scope: tokenJson.scope,
      expiresAt: new Date(Date.now() + tokenJson.expires_in * 1000),
    },
    create: {
      userId: user.id,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      scope: tokenJson.scope,
      expiresAt: new Date(Date.now() + tokenJson.expires_in * 1000),
    },
  });

  const response = NextResponse.redirect(new URL("/settings?connected=1", req.nextUrl.origin));
  response.cookies.delete("fitbit_oauth_state");
  return response;
}
