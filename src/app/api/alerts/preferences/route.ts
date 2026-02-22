import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { getOrCreateAlertPreferences } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  minSleepHours: z.number().min(0).max(24),
  minAvgSteps: z.number().int().min(0).max(100000),
  minZone2Days: z.number().int().min(0).max(7),
  maxRestingHrDelta: z.number().min(0).max(40),
  alertsEnabled: z.boolean(),
});

export async function GET() {
  const user = await getOrCreateSingleUser();
  const prefs = await getOrCreateAlertPreferences(user.id);
  return NextResponse.json(prefs);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert preferences payload." }, { status: 400 });
  }

  const user = await getOrCreateSingleUser();
  const updated = await prisma.alertPreference.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });

  return NextResponse.json({
    minSleepHours: updated.minSleepHours,
    minAvgSteps: updated.minAvgSteps,
    minZone2Days: updated.minZone2Days,
    maxRestingHrDelta: updated.maxRestingHrDelta,
    alertsEnabled: updated.alertsEnabled,
  });
}
