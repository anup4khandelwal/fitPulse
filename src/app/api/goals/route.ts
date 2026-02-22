import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { getOrCreateWeeklyGoals } from "@/lib/goals";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  zone2TargetMinutes: z.number().int().min(0).max(2000),
  avgSleepTargetHours: z.number().min(0).max(24),
  avgStepsTarget: z.number().int().min(0).max(100000),
  sleepScoreMode: z.enum(["fitbit", "recovery"]),
});

export async function GET() {
  const user = await getOrCreateSingleUser();
  const goals = await getOrCreateWeeklyGoals(user.id);
  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid goals payload." }, { status: 400 });
  }

  const user = await getOrCreateSingleUser();
  const updated = await prisma.weeklyGoal.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: {
      userId: user.id,
      ...parsed.data,
    },
  });

  return NextResponse.json({
    zone2TargetMinutes: updated.zone2TargetMinutes,
    avgSleepTargetHours: updated.avgSleepTargetHours,
    avgStepsTarget: updated.avgStepsTarget,
    sleepScoreMode: updated.sleepScoreMode,
  });
}
