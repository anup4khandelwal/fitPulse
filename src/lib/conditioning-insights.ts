import { addDays, format, startOfDay, startOfWeek, subDays } from "date-fns";

import type { DayDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";

export type ConditioningInsightsPayload = {
  weekly: {
    activeMinutes: number;
    avgDailyActiveMinutes: number;
    sedentaryHours: number;
    zone2Minutes: number;
    hardMinutes: number;
    easyMinutes: number;
    easyPct: number;
    hardPct: number;
    highIntensityDays: number;
    zone2Status: "low" | "target" | "high";
  };
  adherence: {
    workoutDays: number;
    targetWorkoutDays: number;
    adherencePct: number;
    remainingWorkoutDays: number;
  };
  polarizedPlan: {
    suggestedEasyMinutes: number;
    suggestedHardMinutesCap: number;
    sessions: Array<{ day: string; type: "easy" | "hard"; minutes: number }>;
  };
  coachNotes: string[];
};

type ConditioningRow = {
  date: Date;
  activeMinutes: number;
  sedentaryMinutes: number;
  lightlyActiveMins: number;
  fairlyActiveMins: number;
  veryActiveMins: number;
  minutesAsleep: number;
  zone2Minutes: number;
  cardioMinutes: number | null;
  peakMinutes: number | null;
};

function round1(value: number) {
  return Number(value.toFixed(1));
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function zone2Status(total: number): ConditioningInsightsPayload["weekly"]["zone2Status"] {
  if (total < 150) return "low";
  if (total > 300) return "high";
  return "target";
}

function buildPayload(rows: ConditioningRow[], workoutDays: number, targetWorkoutDays = 4): ConditioningInsightsPayload {
  const weeklyRows = rows.slice(-7);

  const activeMinutes = weeklyRows.reduce((acc, row) => acc + row.activeMinutes, 0);
  const zone2Minutes = weeklyRows.reduce((acc, row) => acc + row.zone2Minutes, 0);
  const hardMinutes = weeklyRows.reduce((acc, row) => acc + (row.cardioMinutes ?? 0) + (row.peakMinutes ?? 0), 0);
  const easyMinutes = weeklyRows.reduce((acc, row) => acc + row.lightlyActiveMins + row.zone2Minutes, 0);
  const totalLoadMinutes = easyMinutes + hardMinutes;

  const sedentaryHours =
    weeklyRows.length > 0
      ? round1(
          weeklyRows.reduce((acc, row) => acc + row.sedentaryMinutes, 0) / weeklyRows.length / 60,
        )
      : 0;

  const highIntensityDays = weeklyRows.filter((row) => (row.cardioMinutes ?? 0) + (row.peakMinutes ?? 0) >= 12).length;
  const adherencePct = Math.min(100, pct(workoutDays, targetWorkoutDays));
  const remainingWorkoutDays = Math.max(0, targetWorkoutDays - workoutDays);

  const easyPct = pct(easyMinutes, totalLoadMinutes);
  const hardPct = pct(hardMinutes, totalLoadMinutes);

  const coachNotes: string[] = [];
  if (zone2Minutes < 150) {
    coachNotes.push(`Zone 2 volume is ${zone2Minutes}m this week. Push toward 150-300m for aerobic base.`);
  }
  if (hardPct > 25) {
    coachNotes.push(`Intensity split is ${easyPct}/${hardPct}. Shift next sessions to easy effort to stay near 80/20.`);
  }
  if (sedentaryHours > 12) {
    coachNotes.push(`Sedentary time is ${sedentaryHours}h/day. Add short movement breaks every 60-90 minutes.`);
  }
  if (highIntensityDays > 3) {
    coachNotes.push("High-intensity load appears elevated this week. Keep hard days to 1-3 weekly.");
  }
  if (coachNotes.length === 0) {
    coachNotes.push("Conditioning load and intensity split look balanced. Keep your current pattern.");
  }

  const suggestedEasyMinutes = Math.max(0, 180 - zone2Minutes);
  const suggestedHardMinutesCap = Math.max(30, Math.round((activeMinutes + hardMinutes) * 0.2));
  const next3Days = [1, 2, 3].map((offset) => format(addDays(startOfDay(new Date()), offset), "EEE"));
  const sessions = [
    { day: next3Days[0], type: "easy" as const, minutes: Math.max(30, Math.ceil(suggestedEasyMinutes / 2 || 30)) },
    { day: next3Days[1], type: "easy" as const, minutes: Math.max(25, Math.ceil(suggestedEasyMinutes / 2 || 25)) },
    { day: next3Days[2], type: "hard" as const, minutes: Math.min(25, suggestedHardMinutesCap) },
  ];

  return {
    weekly: {
      activeMinutes,
      avgDailyActiveMinutes: weeklyRows.length ? Math.round(activeMinutes / weeklyRows.length) : 0,
      sedentaryHours,
      zone2Minutes,
      hardMinutes,
      easyMinutes,
      easyPct,
      hardPct,
      highIntensityDays,
      zone2Status: zone2Status(zone2Minutes),
    },
    adherence: {
      workoutDays,
      targetWorkoutDays,
      adherencePct,
      remainingWorkoutDays,
    },
    polarizedPlan: {
      suggestedEasyMinutes,
      suggestedHardMinutesCap,
      sessions,
    },
    coachNotes,
  };
}

export async function getConditioningInsights(userId: string): Promise<ConditioningInsightsPayload> {
  const today = startOfDay(new Date());
  const from = subDays(today, 13);
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });

  const [summaries, sleeps, zones, activityDays] = await Promise.all([
    prisma.dailySummary.findMany({
      where: { userId, date: { gte: from, lte: today } },
      orderBy: { date: "asc" },
    }),
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: from, lte: today } },
      select: { date: true, minutesAsleep: true },
      orderBy: { date: "asc" },
    }),
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: from, lte: today } },
      select: { date: true, zone2Minutes: true, cardioMinutes: true, peakMinutes: true },
      orderBy: { date: "asc" },
    }),
    prisma.activityLog.findMany({
      where: { userId, startTime: { gte: weekStart, lte: addDays(today, 1) } },
      select: { startTime: true },
    }),
  ]);

  const dayMap = new Map<string, ConditioningRow>();
  for (let day = from; day <= today; day = addDays(day, 1)) {
    dayMap.set(format(day, "yyyy-MM-dd"), {
      date: day,
      activeMinutes: 0,
      sedentaryMinutes: 0,
      lightlyActiveMins: 0,
      fairlyActiveMins: 0,
      veryActiveMins: 0,
      minutesAsleep: 0,
      zone2Minutes: 0,
      cardioMinutes: 0,
      peakMinutes: 0,
    });
  }

  for (const row of summaries) {
    const summary = row as {
      date: Date;
      activeMinutes: number;
      sedentaryMinutes?: number;
      lightlyActiveMins?: number;
      fairlyActiveMins?: number;
      veryActiveMins?: number;
    };
    const key = format(row.date, "yyyy-MM-dd");
    const item = dayMap.get(key);
    if (item) {
      item.activeMinutes = summary.activeMinutes;
      item.sedentaryMinutes = summary.sedentaryMinutes ?? 0;
      item.lightlyActiveMins = summary.lightlyActiveMins ?? Math.max(0, Math.round(summary.activeMinutes * 0.5));
      item.fairlyActiveMins = summary.fairlyActiveMins ?? Math.max(0, Math.round(summary.activeMinutes * 0.3));
      item.veryActiveMins =
        summary.veryActiveMins ??
        Math.max(0, summary.activeMinutes - item.lightlyActiveMins - item.fairlyActiveMins);
    }
  }
  for (const row of sleeps) {
    const key = format(row.date, "yyyy-MM-dd");
    const item = dayMap.get(key);
    if (item) item.minutesAsleep = row.minutesAsleep;
  }
  for (const row of zones) {
    const key = format(row.date, "yyyy-MM-dd");
    const item = dayMap.get(key);
    if (!item) continue;
    item.zone2Minutes = row.zone2Minutes;
    item.cardioMinutes = row.cardioMinutes;
    item.peakMinutes = row.peakMinutes;
  }

  const workoutDays = new Set(activityDays.map((row) => format(row.startTime, "yyyy-MM-dd"))).size;

  return buildPayload(Array.from(dayMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime()), workoutDays);
}

export function buildDemoConditioningInsights(days: DayDashboard[]): ConditioningInsightsPayload {
  const rows = days
    .filter((day) => day.date <= format(new Date(), "yyyy-MM-dd"))
    .map((day) => ({
      date: new Date(`${day.date}T00:00:00.000Z`),
      activeMinutes: day.activeMinutes,
      sedentaryMinutes: day.sedentaryMinutes,
      lightlyActiveMins: day.lightlyActiveMins,
      fairlyActiveMins: day.fairlyActiveMins,
      veryActiveMins: day.veryActiveMins,
      minutesAsleep: day.sleepMinutes,
      zone2Minutes: day.zone2Minutes,
      cardioMinutes: day.cardioMinutes,
      peakMinutes: day.peakMinutes,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-14);

  const workoutDays = new Set(
    days
      .filter((day) => day.date >= format(subDays(startOfDay(new Date()), 6), "yyyy-MM-dd"))
      .filter((day) => day.activities.length > 0)
      .map((day) => day.date),
  ).size;

  return buildPayload(rows, workoutDays);
}
