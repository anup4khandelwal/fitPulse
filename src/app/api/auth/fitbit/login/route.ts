import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { getFitbitEnv, hasFitbitCredentials } from "@/lib/env";

const SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.profile.readonly",
];

export async function GET() {
  if (!hasFitbitCredentials()) {
    return NextResponse.json({ error: "Missing Google Health API env vars" }, { status: 500 });
  }

  const { clientId, redirectUri } = getFitbitEnv();
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.cookies.set("fitbit_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
