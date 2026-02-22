import { NextRequest, NextResponse } from "next/server";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { evaluateAndStoreAlerts } from "@/lib/alerts";
import { getAutoSyncDays, getAutoSyncSecret } from "@/lib/env";
import { FitbitApiError } from "@/lib/fitbit/client";
import { prisma } from "@/lib/prisma";
import { getAutoSyncRange, runLoggedSync } from "@/lib/sync-run";

function isAuthorized(req: NextRequest) {
  const secret = getAutoSyncSecret();
  if (!secret) {
    return false;
  }

  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${secret}`) {
    return true;
  }

  return req.headers.get("x-sync-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateSingleUser();
  const auth = await prisma.fitbitAuth.findUnique({ where: { userId: user.id } });
  if (!auth) {
    return NextResponse.json({ error: "Fitbit not connected." }, { status: 409 });
  }

  const range = getAutoSyncRange(getAutoSyncDays());

  try {
    const result = await runLoggedSync({
      userId: user.id,
      from: range.from,
      to: range.to,
      trigger: "auto",
      maxAttempts: 3,
    });
    const alerts = await evaluateAndStoreAlerts(user.id);

    return NextResponse.json({
      message: `Auto-sync completed for ${result.syncedDays} day(s).`,
      from: range.from,
      to: range.to,
      warnings: result.warnings,
      attempts: result.attempts,
      status: result.status,
      alertsCreated: alerts.length,
    });
  } catch (error) {
    if (error instanceof FitbitApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unexpected auto-sync failure." }, { status: 500 });
  }
}
