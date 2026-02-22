import type { WeeklySummary } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";

export type WeeklyGoals = {
  zone2TargetMinutes: number;
  avgSleepTargetHours: number;
  avgStepsTarget: number;
  sleepScoreMode: "fitbit" | "recovery";
};

export type GoalProgressMetric = {
  label: string;
  unit: string;
  current: number;
  target: number;
  percent: number;
  remaining: number;
};

export type GoalsPayload = {
  goals: WeeklyGoals;
  progress: GoalProgressMetric[];
  nudges: string[];
};

const DEFAULT_GOALS: WeeklyGoals = {
  zone2TargetMinutes: 180,
  avgSleepTargetHours: 7,
  avgStepsTarget: 8500,
  sleepScoreMode: "fitbit",
};

function toPercent(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function toProgress(summary: WeeklySummary, goals: WeeklyGoals): GoalProgressMetric[] {
  return [
    {
      label: "Zone 2 this week",
      unit: "m",
      current: summary.totalZone2Minutes,
      target: goals.zone2TargetMinutes,
      percent: toPercent(summary.totalZone2Minutes, goals.zone2TargetMinutes),
      remaining: Math.max(0, goals.zone2TargetMinutes - summary.totalZone2Minutes),
    },
    {
      label: "Avg sleep",
      unit: "h",
      current: summary.averageSleepHours,
      target: goals.avgSleepTargetHours,
      percent: toPercent(summary.averageSleepHours, goals.avgSleepTargetHours),
      remaining: Math.max(0, goals.avgSleepTargetHours - summary.averageSleepHours),
    },
    {
      label: "Avg steps",
      unit: "steps",
      current: summary.averageSteps,
      target: goals.avgStepsTarget,
      percent: toPercent(summary.averageSteps, goals.avgStepsTarget),
      remaining: Math.max(0, goals.avgStepsTarget - summary.averageSteps),
    },
  ];
}

function buildNudges(summary: WeeklySummary, goals: WeeklyGoals) {
  const nudges: string[] = [];

  const zone2Gap = goals.zone2TargetMinutes - summary.totalZone2Minutes;
  if (zone2Gap > 0) {
    nudges.push(`Need ${zone2Gap} more Zone 2 minutes this week. Try 2 to 3 brisk sessions.`);
  }

  const sleepGap = goals.avgSleepTargetHours - summary.averageSleepHours;
  if (sleepGap > 0.15) {
    const extraMinutes = Math.round(sleepGap * 60);
    nudges.push(`Add about ${extraMinutes} minutes/night to hit your sleep goal.`);
  }

  const stepsGap = goals.avgStepsTarget - summary.averageSteps;
  if (stepsGap > 350) {
    nudges.push(`Increase by about ${stepsGap.toLocaleString()} steps/day to reach your weekly step target.`);
  }

  if (nudges.length === 0) {
    nudges.push("All weekly goals are on track. Keep your routine consistent.");
  }

  return nudges;
}

export function buildGoalsPayload(summary: WeeklySummary, goals: WeeklyGoals): GoalsPayload {
  return {
    goals,
    progress: toProgress(summary, goals),
    nudges: buildNudges(summary, goals),
  };
}

export function getDefaultGoals(): WeeklyGoals {
  return DEFAULT_GOALS;
}

export async function getOrCreateWeeklyGoals(userId: string): Promise<WeeklyGoals> {
  const row = await prisma.weeklyGoal.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      zone2TargetMinutes: DEFAULT_GOALS.zone2TargetMinutes,
      avgSleepTargetHours: DEFAULT_GOALS.avgSleepTargetHours,
      avgStepsTarget: DEFAULT_GOALS.avgStepsTarget,
      sleepScoreMode: DEFAULT_GOALS.sleepScoreMode,
    },
  });

  return {
    zone2TargetMinutes: row.zone2TargetMinutes,
    avgSleepTargetHours: row.avgSleepTargetHours,
    avgStepsTarget: row.avgStepsTarget,
    sleepScoreMode: row.sleepScoreMode === "recovery" ? "recovery" : "fitbit",
  };
}
