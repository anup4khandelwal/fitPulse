import { addDays, format, startOfDay, subDays } from "date-fns";

import { prisma } from "@/lib/prisma";

export type RhrZone2InsightsPayload = {
  baseline: {
    rhr7d: number | null;
    rhr30d: number | null;
    todayRhr: number | null;
    deltaVs30d: number | null;
    status: "improving" | "stable" | "elevated" | "unknown";
  };
  readiness: {
    score: number;
    label: "High" | "Moderate" | "Low";
    reasons: string[];
  };
  planner: {
    targetZone2Days: number;
    completedZone2Days: number;
    remainingDays: number;
    suggestedSessions: Array<{ day: string; minutes: number }>;
  };
};

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(value: number | null) {
  return value === null ? null : Number(value.toFixed(1));
}

function computeStatus(delta: number | null): RhrZone2InsightsPayload["baseline"]["status"] {
  if (delta === null) return "unknown";
  if (delta <= -2) return "improving";
  if (delta >= 2) return "elevated";
  return "stable";
}

function readinessLabel(score: number): RhrZone2InsightsPayload["readiness"]["label"] {
  if (score >= 75) return "High";
  if (score >= 50) return "Moderate";
  return "Low";
}

export async function getRhrZone2Insights(userId: string): Promise<RhrZone2InsightsPayload> {
  const today = startOfDay(new Date());
  const from30 = subDays(today, 29);
  const from7 = subDays(today, 6);

  const [heartRows, sleepRows] = await Promise.all([
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: from30, lte: today } },
      select: { date: true, restingHeartRate: true, zone2Minutes: true },
      orderBy: { date: "asc" },
    }),
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: from7, lte: today } },
      select: { date: true, minutesAsleep: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const rhr7 = heartRows
    .filter((row) => row.date >= from7)
    .map((row) => row.restingHeartRate)
    .filter((value): value is number => value !== null);
  const rhr30 = heartRows.map((row) => row.restingHeartRate).filter((value): value is number => value !== null);

  const todayRhr = heartRows.find((row) => format(row.date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))?.restingHeartRate ?? null;
  const rhr7d = avg(rhr7);
  const rhr30d = avg(rhr30);
  const deltaVs30d = todayRhr !== null && rhr30d !== null ? todayRhr - rhr30d : null;

  const targetZone2Days = 5;
  const completedZone2Days = heartRows.filter((row) => row.date >= from7 && row.zone2Minutes > 0).length;
  const remaining = Math.max(0, targetZone2Days - completedZone2Days);
  const weekEnd = addDays(subDays(today, today.getDay()), 6);
  const remainingDays = Math.max(1, Math.ceil((weekEnd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const perSession = remaining > 0 ? Math.max(20, Math.ceil((150 - heartRows.filter((r) => r.date >= from7).reduce((a, b) => a + b.zone2Minutes, 0)) / remaining)) : 0;

  const suggestedSessions = Array.from({ length: Math.min(remaining, remainingDays) }).map((_, idx) => ({
    day: format(addDays(today, idx + 1), "EEE"),
    minutes: perSession,
  }));

  const avgSleepHours = avg(sleepRows.map((row) => row.minutesAsleep / 60));
  const zone2Last3Days = heartRows.filter((row) => row.date >= subDays(today, 2)).reduce((acc, row) => acc + row.zone2Minutes, 0);

  let score = 100;
  const reasons: string[] = [];

  if (deltaVs30d !== null && deltaVs30d > 3) {
    score -= 30;
    reasons.push(`RHR is up ${deltaVs30d.toFixed(1)} bpm vs 30d baseline.`);
  }
  if (avgSleepHours !== null && avgSleepHours < 6.5) {
    score -= 25;
    reasons.push(`Recent sleep average is ${avgSleepHours.toFixed(1)}h.`);
  }
  if (zone2Last3Days > 120) {
    score -= 15;
    reasons.push("High Zone2 load in the last 3 days.");
  }

  score = Math.max(0, Math.min(100, score));
  if (reasons.length === 0) {
    reasons.push("RHR, sleep, and recent load look balanced.");
  }

  return {
    baseline: {
      rhr7d: round1(rhr7d),
      rhr30d: round1(rhr30d),
      todayRhr,
      deltaVs30d: round1(deltaVs30d),
      status: computeStatus(deltaVs30d),
    },
    readiness: {
      score,
      label: readinessLabel(score),
      reasons,
    },
    planner: {
      targetZone2Days,
      completedZone2Days,
      remainingDays,
      suggestedSessions,
    },
  };
}

export function buildDemoRhrZone2Insights(): RhrZone2InsightsPayload {
  return {
    baseline: {
      rhr7d: 57.6,
      rhr30d: 58.8,
      todayRhr: 57,
      deltaVs30d: -1.8,
      status: "stable",
    },
    readiness: {
      score: 78,
      label: "High",
      reasons: ["RHR is near baseline and sleep is consistent."],
    },
    planner: {
      targetZone2Days: 5,
      completedZone2Days: 3,
      remainingDays: 3,
      suggestedSessions: [
        { day: "Tue", minutes: 30 },
        { day: "Thu", minutes: 30 },
      ],
    },
  };
}
