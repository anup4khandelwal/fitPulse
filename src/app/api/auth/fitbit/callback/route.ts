import { NextRequest, NextResponse } from "next/server";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { getFitbitEnv } from "@/lib/env";
import { FitbitTokenResponse } from "@/lib/fitbit/client";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("fitbit_oauth_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.json({ error: "Invalid OAuth state/code" }, { status: 400 });
  }

  const { clientId, clientSecret, redirectUri } = getFitbitEnv();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "Fitbit token exchange failed" }, { status: 400 });
  }

  const tokenJson = (await tokenResponse.json()) as FitbitTokenResponse;
  const user = await getOrCreateSingleUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { fitbitUserId: tokenJson.user_id },
  });

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
