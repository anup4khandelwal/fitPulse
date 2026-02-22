import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek, subDays } from "date-fns";

import type { DayDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";

export type StepInsightsPayload = {
  dailyTarget: number;
  todaySteps: number;
  weeklyPacing: {
    targetTotal: number;
    currentTotal: number;
    expectedByToday: number;
    status: "ahead" | "on_track" | "behind";
    gap: number;
  };
  streaks: {
    current: number;
    best: number;
    lastBreak: string | null;
  };
  peakWindows: Array<{
    label: string;
    steps: number;
    pace: number;
  }>;
  distribution: {
    morning: number;
    afternoon: number;
    evening: number;
  };
  coaching: {
    todayTarget: number;
    message: string;
  };
  progressionPlan: Array<{
    day: string;
    target: number;
  }>;
};

type SummaryRow = {
  date: Date;
  steps: number;
};

type ActivityRow = {
  startTime: Date;
  durationMinutes: number;
  steps: number | null;
};

function buildMap(rows: SummaryRow[]) {
  return new Map(rows.map((row) => [format(row.date, "yyyy-MM-dd"), row.steps]));
}

function contiguousCurrentStreak(map: Map<string, number>, target: number) {
  let streak = 0;
  for (let offset = 0; offset < 120; offset += 1) {
    const day = format(subDays(startOfDay(new Date()), offset), "yyyy-MM-dd");
    const steps = map.get(day);
    if (steps === undefined || steps < target) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function bestStreak(map: Map<string, number>, target: number) {
  const dates = [...map.keys()].sort();
  let best = 0;
  let current = 0;
  let prev: Date | null = null;

  for (const key of dates) {
    const date = new Date(`${key}T00:00:00.000Z`);
    const steps = map.get(key) ?? 0;
    const hit = steps >= target;

    if (!hit) {
      current = 0;
      prev = date;
      continue;
    }

    if (prev && differenceInCalendarDays(date, prev) === 1 && current > 0) {
      current += 1;
    } else {
      current = 1;
    }

    if (current > best) {
      best = current;
    }

    prev = date;
  }

  return best;
}

function lastBreak(map: Map<string, number>, target: number) {
  for (let offset = 0; offset < 120; offset += 1) {
    const day = format(subDays(startOfDay(new Date()), offset), "yyyy-MM-dd");
    const steps = map.get(day);
    if (steps !== undefined && steps < target) {
      return day;
    }
  }
  return null;
}

function weeklyPacing(rows: SummaryRow[], dailyTarget: number) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const daysElapsed = differenceInCalendarDays(today, weekStart) + 1;

  const currentTotal = rows
    .filter((row) => row.date >= weekStart && row.date <= today)
    .reduce((acc, row) => acc + row.steps, 0);

  const expectedByToday = dailyTarget * daysElapsed;
  const gap = currentTotal - expectedByToday;

  let status: "ahead" | "on_track" | "behind" = "on_track";
  if (gap > dailyTarget * 0.2) {
    status = "ahead";
  } else if (gap < -dailyTarget * 0.2) {
    status = "behind";
  }

  return {
    targetTotal: dailyTarget * 7,
    currentTotal,
    expectedByToday,
    status,
    gap,
  };
}

function topPeakWindows(rows: ActivityRow[]) {
  return rows
    .filter((row) => (row.steps ?? 0) > 0 && row.durationMinutes > 0)
    .map((row) => {
      const steps = row.steps ?? 0;
      const pace = steps / row.durationMinutes;
      return {
        label: format(row.startTime, "EEE p"),
        steps,
        pace,
      };
    })
    .sort((a, b) => b.steps - a.steps)
    .slice(0, 3)
    .map((row) => ({ ...row, pace: Number(row.pace.toFixed(1)) }));
}

function dayDistribution(rows: ActivityRow[]) {
  const totals = { morning: 0, afternoon: 0, evening: 0 };

  for (const row of rows) {
    const steps = row.steps ?? 0;
    if (!steps) continue;

    const hour = row.startTime.getHours();
    if (hour < 12) {
      totals.morning += steps;
    } else if (hour < 17) {
      totals.afternoon += steps;
    } else {
      totals.evening += steps;
    }
  }

  const sum = totals.morning + totals.afternoon + totals.evening;
  if (sum === 0) return totals;

  return {
    morning: Math.round((totals.morning / sum) * 100),
    afternoon: Math.round((totals.afternoon / sum) * 100),
    evening: Math.round((totals.evening / sum) * 100),
  };
}

function coaching(week: ReturnType<typeof weeklyPacing>, dailyTarget: number, todaySteps: number) {
  const today = startOfDay(new Date());
  const weekEnd = addDays(startOfWeek(today, { weekStartsOn: 0 }), 6);
  const remainingDays = Math.max(1, differenceInCalendarDays(weekEnd, today) + 1);

  const remainingWeeklyTarget = Math.max(0, week.targetTotal - week.currentTotal);
  const todayTarget = Math.max(dailyTarget, Math.ceil(remainingWeeklyTarget / remainingDays));
  const remainingToday = Math.max(0, todayTarget - todaySteps);

  let message = "You are on track. Keep your usual walking routine.";
  if (remainingToday > 1500) {
    message = `Need ${remainingToday.toLocaleString()} more steps today. Add a 20-30 minute walk.`;
  } else if (remainingToday > 0) {
    message = `Need ${remainingToday.toLocaleString()} more steps to hit today’s coaching target.`;
  }

  return { todayTarget, message };
}

function progressionPlan(week: ReturnType<typeof weeklyPacing>, dailyTarget: number) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });

  const days: Array<{ day: string; target: number }> = [];
  const remaining = Math.max(0, week.targetTotal - week.currentTotal);
  const remainingDays = Math.max(1, 7 - (differenceInCalendarDays(today, weekStart) + 1));
  const perDay = Math.ceil(remaining / remainingDays || dailyTarget);

  for (let i = 1; i <= remainingDays; i += 1) {
    const date = addDays(today, i);
    days.push({ day: format(date, "EEE"), target: Math.max(dailyTarget, perDay) });
  }

  return days;
}

function buildPayload(summaries: SummaryRow[], activities: ActivityRow[], dailyTarget: number): StepInsightsPayload {
  const map = buildMap(summaries);
  const todayKey = format(startOfDay(new Date()), "yyyy-MM-dd");
  const todaySteps = map.get(todayKey) ?? 0;
  const pacing = weeklyPacing(summaries, dailyTarget);

  return {
    dailyTarget,
    todaySteps,
    weeklyPacing: pacing,
    streaks: {
      current: contiguousCurrentStreak(map, dailyTarget),
      best: bestStreak(map, dailyTarget),
      lastBreak: lastBreak(map, dailyTarget),
    },
    peakWindows: topPeakWindows(activities),
    distribution: dayDistribution(activities),
    coaching: coaching(pacing, dailyTarget, todaySteps),
    progressionPlan: progressionPlan(pacing, dailyTarget),
  };
}

export async function getStepInsights(userId: string, dailyTarget: number): Promise<StepInsightsPayload> {
  const today = startOfDay(new Date());
  const summariesFrom = subDays(today, 120);
  const activitiesFrom = subDays(today, 14);

  const [summaries, activities] = await Promise.all([
    prisma.dailySummary.findMany({
      where: { userId, date: { gte: summariesFrom, lte: today } },
      select: { date: true, steps: true },
      orderBy: { date: "asc" },
    }),
    prisma.activityLog.findMany({
      where: { userId, startTime: { gte: activitiesFrom, lte: addDays(today, 1) } },
      select: { startTime: true, durationMinutes: true, steps: true },
    }),
  ]);

  return buildPayload(summaries, activities, dailyTarget);
}

export function buildDemoStepInsights(days: DayDashboard[], dailyTarget: number): StepInsightsPayload {
  const summaries = days
    .filter((day) => day.date <= format(new Date(), "yyyy-MM-dd"))
    .map((day) => ({ date: new Date(`${day.date}T00:00:00.000Z`), steps: day.steps }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-120);

  const activities = days
    .flatMap((day) =>
      day.activities.map((activity) => ({
        startTime: new Date(activity.startTime),
        durationMinutes: activity.durationMinutes,
        steps: activity.steps,
      })),
    )
    .slice(-60);

  return buildPayload(summaries, activities, dailyTarget);
}
