import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { evaluateAndStoreAlerts } from "@/lib/alerts";
import { FitbitApiError } from "@/lib/fitbit/client";
import { prisma } from "@/lib/prisma";
import { runLoggedSync } from "@/lib/sync-run";

const dateRangeSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

export async function POST(req: NextRequest) {
  const parsed = dateRangeSchema.safeParse({
    from: req.nextUrl.searchParams.get("from"),
    to: req.nextUrl.searchParams.get("to"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid date range. Use from/to in YYYY-MM-DD." }, { status: 400 });
  }

  const user = await getOrCreateSingleUser();
  const auth = await prisma.fitbitAuth.findUnique({ where: { userId: user.id } });
  if (!auth) {
    return NextResponse.json({ error: "Fitbit not connected." }, { status: 401 });
  }

  try {
    const result = await runLoggedSync({
      userId: user.id,
      from: parsed.data.from,
      to: parsed.data.to,
      trigger: "manual",
      maxAttempts: 3,
    });
    const alerts = await evaluateAndStoreAlerts(user.id);
    return NextResponse.json({
      message: `Sync completed for ${result.syncedDays} day(s).`,
      warnings: result.warnings,
      attempts: result.attempts,
      status: result.status,
      alertsCreated: alerts.length,
    });
  } catch (error) {
    if (error instanceof FitbitApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unexpected sync failure." }, { status: 500 });
  }
}
