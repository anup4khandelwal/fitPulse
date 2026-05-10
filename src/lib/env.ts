const requiredEnv = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"] as const;

export function hasFitbitCredentials() {
  return requiredEnv.every((key) => Boolean(process.env[key]));
}

export function getFitbitEnv() {
  if (!hasFitbitCredentials()) {
    throw new Error("Missing Google Health API credentials in environment variables.");
  }

  return {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    redirectUri: process.env.GOOGLE_REDIRECT_URI as string,
  };
}

export const demoModeForced = process.env.DEMO_MODE === "true";

export function getAutoSyncSecret() {
  return process.env.SYNC_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
}

export function getAutoSyncDays() {
  const parsed = Number(process.env.AUTO_SYNC_DAYS ?? "3");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 3;
  }

  return Math.floor(parsed);
}
