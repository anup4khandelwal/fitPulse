import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { getFitbitEnv, hasFitbitCredentials } from "@/lib/env";

const SCOPES = [
  "activity",
  "heartrate",
  "sleep",
  "profile",
  "respiratory_rate",
  "oxygen_saturation",
  "temperature",
  "cardio_fitness",
];

export async function GET() {
  if (!hasFitbitCredentials()) {
    return NextResponse.json({ error: "Missing Fitbit env vars" }, { status: 500 });
  }

  const { clientId, redirectUri } = getFitbitEnv();
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    expires_in: "31536000",
  });

  const response = NextResponse.redirect(`https://www.fitbit.com/oauth2/authorize?${params.toString()}`);
  response.cookies.set("fitbit_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
