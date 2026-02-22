import { FitbitAuth } from "@prisma/client";

import { getFitbitEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: "Bearer";
  user_id: string;
};

export class FitbitApiError extends Error {
  status: number;
  retryAfterSec?: number;

  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

export async function fitbitRefresh(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getFitbitEnv();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new FitbitApiError(`Token refresh failed (${response.status})`, response.status);
  }

  return (await response.json()) as TokenResponse;
}

export async function fitbitFetch(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.fitbit.com${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    throw new FitbitApiError(
      "Fitbit rate limit reached. Try syncing again shortly.",
      429,
      retryAfter ? Number(retryAfter) : undefined,
    );
  }

  return response;
}

export async function ensureValidToken(userId: string): Promise<{ accessToken: string; auth: FitbitAuth }> {
  const auth = await prisma.fitbitAuth.findUnique({ where: { userId } });

  if (!auth) {
    throw new FitbitApiError("Fitbit is not connected", 401);
  }

  const now = Date.now();
  const isExpired = auth.expiresAt.getTime() <= now + 60_000;

  if (!isExpired) {
    return { accessToken: auth.accessToken, auth };
  }

  const refreshed = await fitbitRefresh(auth.refreshToken);

  const updated = await prisma.fitbitAuth.update({
    where: { userId },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      scope: refreshed.scope,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });

  return { accessToken: updated.accessToken, auth: updated };
}

export async function fitbitFetchWithAutoRefresh(userId: string, path: string, init?: RequestInit) {
  const { accessToken } = await ensureValidToken(userId);
  let response = await fitbitFetch(accessToken, path, init);

  if (response.status !== 401) {
    return response;
  }

  const auth = await prisma.fitbitAuth.findUnique({ where: { userId } });
  if (!auth) {
    throw new FitbitApiError("Fitbit token not found", 401);
  }

  const refreshed = await fitbitRefresh(auth.refreshToken);
  await prisma.fitbitAuth.update({
    where: { userId },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      scope: refreshed.scope,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });

  response = await fitbitFetch(refreshed.access_token, path, init);
  return response;
}

export type FitbitTokenResponse = TokenResponse;
