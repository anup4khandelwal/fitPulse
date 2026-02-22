import { startOfDay, subDays } from "date-fns";

import type { DayDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { calculateSleepScore, type SleepScoreMode } from "@/lib/sleep-score";

export type SleepInsightsPayload = {
  targetSleepHours: number;
  sleepScore: {
    latest: number | null;
    average7d: number | null;
  };
  sleepDebtHours: number;
  poorNightsLast14: number;
  consistency: {
    bedtimeStdMinutes: number;
    wakeStdMinutes: number;
    score: number;
    avgBedtime: string;
    avgWakeTime: string;
  };
  stageTrend: {
    deepDelta: number;
    remDelta: number;
    lightDelta: number;
    wakeDelta: number;
  };
  smartFlags: string[];
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function clockMinutes(date: Date, forBedtime = false) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (forBedtime && minutes < 12 * 60) {
    return minutes + 24 * 60;
  }
  return minutes;
}

function minutesToClock(value: number) {
  const normalized = ((Math.round(value) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function stageAverage(rows: Array<{ deep: number; rem: number; light: number; wake: number }>, key: "deep" | "rem" | "light" | "wake") {
  return average(rows.map((row) => row[key]));
}

function buildPayload(
  rows: Array<{
    date: Date;
    minutesAsleep: number;
    timeInBed: number;
    efficiency: number;
    deepMinutes: number | null;
    remMinutes: number | null;
    lightMinutes: number | null;
    wakeMinutes: number | null;
    sleepStart: Date | null;
    sleepEnd: Date | null;
  }>,
  targetSleepHours: number,
  sleepScoreMode: SleepScoreMode,
): SleepInsightsPayload {
  const today = startOfDay(new Date());
  const last14Cutoff = subDays(today, 13);
  const last7Cutoff = subDays(today, 6);
  const prev7Start = subDays(today, 13);
  const prev7End = subDays(today, 7);

  const rows14 = rows.filter((row) => row.date >= last14Cutoff && row.date <= today);
  const rows7 = rows.filter((row) => row.date >= last7Cutoff && row.date <= today);
  const prev7 = rows.filter((row) => row.date >= prev7Start && row.date <= prev7End);

  const targetMin = targetSleepHours * 60;
  const debtMinutes = rows14.reduce((acc, row) => acc + Math.max(0, targetMin - row.minutesAsleep), 0);
  const poorNightsLast14 = rows14.filter((row) => row.minutesAsleep < targetMin).length;

  const bedtimeMinutes = rows14
    .map((row) => row.sleepStart)
    .filter((value): value is Date => value !== null)
    .map((value) => clockMinutes(value, true));
  const wakeMinutes = rows14
    .map((row) => row.sleepEnd)
    .filter((value): value is Date => value !== null)
    .map((value) => clockMinutes(value));

  const bedtimeStdMinutes = stddev(bedtimeMinutes);
  const wakeStdMinutes = stddev(wakeMinutes);
  const score = Math.max(0, Math.round(100 - (bedtimeStdMinutes + wakeStdMinutes) * 0.65));

  const normalize = (row: {
    deepMinutes: number | null;
    remMinutes: number | null;
    lightMinutes: number | null;
    wakeMinutes: number | null;
  }) => ({
    deep: row.deepMinutes ?? 0,
    rem: row.remMinutes ?? 0,
    light: row.lightMinutes ?? 0,
    wake: row.wakeMinutes ?? 0,
  });

  const currentStages = rows7.map(normalize);
  const baselineStages = prev7.map(normalize);

  const deepDelta = stageAverage(currentStages, "deep") - stageAverage(baselineStages, "deep");
  const remDelta = stageAverage(currentStages, "rem") - stageAverage(baselineStages, "rem");
  const lightDelta = stageAverage(currentStages, "light") - stageAverage(baselineStages, "light");
  const wakeDelta = stageAverage(currentStages, "wake") - stageAverage(baselineStages, "wake");

  const smartFlags: string[] = [];

  const recent3 = [...rows].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 3);
  if (recent3.length === 3 && recent3.every((row) => row.minutesAsleep < targetMin)) {
    smartFlags.push("Three poor sleep nights in a row. Consider an early recovery night.");
  }

  const currentBedAvg = average(
    rows7.map((row) => row.sleepStart).filter((value): value is Date => value !== null).map((value) => clockMinutes(value, true)),
  );
  const baselineBedAvg = average(
    prev7.map((row) => row.sleepStart).filter((value): value is Date => value !== null).map((value) => clockMinutes(value, true)),
  );

  if (currentBedAvg > 0 && baselineBedAvg > 0 && currentBedAvg - baselineBedAvg > 45) {
    smartFlags.push(`Bedtime drifted later by ${Math.round(currentBedAvg - baselineBedAvg)} minutes vs prior week.`);
  }

  if (remDelta < -15) {
    smartFlags.push(`REM sleep is down ${Math.round(Math.abs(remDelta))} min/night vs prior week.`);
  }

  if (smartFlags.length === 0) {
    smartFlags.push("Sleep patterns look stable this week.");
  }

  const scoredRows = rows14.map((row) =>
    calculateSleepScore(
      {
        minutesAsleep: row.minutesAsleep,
        timeInBed: row.timeInBed,
        efficiency: row.efficiency,
        deepMinutes: row.deepMinutes ?? 0,
        remMinutes: row.remMinutes ?? 0,
        wakeMinutes: row.wakeMinutes ?? 0,
      },
      targetSleepHours,
      sleepScoreMode,
    ),
  );
  const average7dScoreValues = rows7.map((row) =>
    calculateSleepScore(
      {
        minutesAsleep: row.minutesAsleep,
        timeInBed: row.timeInBed,
        efficiency: row.efficiency,
        deepMinutes: row.deepMinutes ?? 0,
        remMinutes: row.remMinutes ?? 0,
        wakeMinutes: row.wakeMinutes ?? 0,
      },
      targetSleepHours,
      sleepScoreMode,
    ),
  );
  const latestScore = scoredRows.length > 0 ? scoredRows[scoredRows.length - 1] : null;
  const average7d = average7dScoreValues.length > 0 ? Math.round(average(average7dScoreValues)) : null;

  return {
    targetSleepHours,
    sleepScore: {
      latest: latestScore,
      average7d,
    },
    sleepDebtHours: Number((debtMinutes / 60).toFixed(1)),
    poorNightsLast14,
    consistency: {
      bedtimeStdMinutes: Math.round(bedtimeStdMinutes),
      wakeStdMinutes: Math.round(wakeStdMinutes),
      score,
      avgBedtime: bedtimeMinutes.length ? minutesToClock(average(bedtimeMinutes)) : "n/a",
      avgWakeTime: wakeMinutes.length ? minutesToClock(average(wakeMinutes)) : "n/a",
    },
    stageTrend: {
      deepDelta: Math.round(deepDelta),
      remDelta: Math.round(remDelta),
      lightDelta: Math.round(lightDelta),
      wakeDelta: Math.round(wakeDelta),
    },
    smartFlags,
  };
}

export async function getSleepInsights(
  userId: string,
  targetSleepHours: number,
  sleepScoreMode: SleepScoreMode,
): Promise<SleepInsightsPayload> {
  const today = startOfDay(new Date());
  const from = subDays(today, 20);

  const rows = await prisma.dailySleep.findMany({
    where: { userId, date: { gte: from, lte: today } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      minutesAsleep: true,
      timeInBed: true,
      efficiency: true,
      deepMinutes: true,
      remMinutes: true,
      lightMinutes: true,
      wakeMinutes: true,
      sleepStart: true,
      sleepEnd: true,
    },
  });

  return buildPayload(rows, targetSleepHours, sleepScoreMode);
}

export function buildDemoSleepInsights(
  days: DayDashboard[],
  targetSleepHours: number,
  sleepScoreMode: SleepScoreMode,
): SleepInsightsPayload {
  const rows = days
    .filter((day) => day.sleep !== null)
    .map((day) => ({
      date: startOfDay(new Date(`${day.date}T00:00:00.000Z`)),
      minutesAsleep: day.sleepMinutes,
      timeInBed: day.sleep?.timeInBed ?? day.sleepMinutes + 42,
      efficiency: day.sleep?.efficiency ?? 90,
      deepMinutes: day.sleep?.deepMinutes ?? 0,
      remMinutes: day.sleep?.remMinutes ?? 0,
      lightMinutes: day.sleep?.lightMinutes ?? 0,
      wakeMinutes: day.sleep?.wakeMinutes ?? 0,
      sleepStart: day.sleep?.sleepStart ? new Date(day.sleep.sleepStart) : null,
      sleepEnd: day.sleep?.sleepEnd ? new Date(day.sleep.sleepEnd) : null,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-21);

  return buildPayload(rows, targetSleepHours, sleepScoreMode);
}
