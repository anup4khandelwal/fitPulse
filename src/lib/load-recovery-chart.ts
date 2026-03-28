import { addDays, format, startOfDay, subDays } from "date-fns";

import type { DayDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { calculateSleepScoreDetailed, type SleepScoreMode } from "@/lib/sleep-score";

type LoadInputs = {
  zone2Minutes: number;
  cardioMinutes: number | null;
  peakMinutes: number | null;
};

type RecoveryScoreInputs = {
  sleepScore: number | null;
  rhrScore: number | null;
  hrvScore: number | null;
};

export type LoadRecoverySourceDay = {
  date: string;
  zone2Minutes: number;
  cardioMinutes: number | null;
  peakMinutes: number | null;
  sleepScore: number | null;
  restingHeartRate: number | null;
  hrvRmssd: number | null;
};

export type LoadRecoveryChartPoint = {
  date: string;
  load: number;
  recovery: number | null;
  hasHrv: boolean;
};

export type LoadRecoverySummary = {
  avgLoad7d: number;
  avgRecovery7d: number | null;
  highestLoadDate: string;
  highestLoadValue: number;
  recoveryCoverage: "full" | "partial";
};

export type LoadRecoveryChartPayload =
  | {
      state: "empty";
      reason: string;
      points: LoadRecoveryChartPoint[];
      summary: null;
    }
  | {
      state: "ready" | "partial";
      points: LoadRecoveryChartPoint[];
      summary: LoadRecoverySummary;
    };

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Number(value.toFixed(1));
}

export function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function averageOrNull(values: number[]) {
  if (values.length === 0) return null;
  return average(values);
}

export function calculateTrainingLoad({
  zone2Minutes,
  cardioMinutes,
  peakMinutes,
}: LoadInputs) {
  return round1(
    zone2Minutes * 1 + (cardioMinutes ?? 0) * 1.75 + (peakMinutes ?? 0) * 2.5,
  );
}

export function scoreRestingHeartRate(
  currentRhr: number | null,
  baselineRhr: number | null,
) {
  if (
    currentRhr === null ||
    baselineRhr === null ||
    !Number.isFinite(currentRhr) ||
    !Number.isFinite(baselineRhr) ||
    baselineRhr <= 0
  ) {
    return null;
  }
  const deltaRatio = (currentRhr - baselineRhr) / baselineRhr;
  return round1(clamp(0, 100 - deltaRatio * 250, 100));
}

export function scoreHrv(currentHrv: number | null, baselineHrv: number | null) {
  if (
    currentHrv === null ||
    baselineHrv === null ||
    !Number.isFinite(currentHrv) ||
    !Number.isFinite(baselineHrv) ||
    baselineHrv <= 0
  ) {
    return null;
  }
  const deltaRatio = (currentHrv - baselineHrv) / baselineHrv;
  return round1(clamp(0, 100 + deltaRatio * 250, 100));
}

export function combineRecoveryScore({
  sleepScore,
  rhrScore,
  hrvScore,
}: RecoveryScoreInputs) {
  if (sleepScore !== null && rhrScore !== null && hrvScore !== null) {
    return round1(sleepScore * 0.5 + rhrScore * 0.25 + hrvScore * 0.25);
  }
  if (sleepScore !== null && rhrScore !== null) {
    return round1(sleepScore * 0.65 + rhrScore * 0.35);
  }
  if (sleepScore !== null && hrvScore !== null) {
    return round1(sleepScore * 0.65 + hrvScore * 0.35);
  }
  if (rhrScore !== null && hrvScore !== null) {
    return round1(rhrScore * 0.5 + hrvScore * 0.5);
  }
  if (sleepScore !== null) return round1(sleepScore);
  if (rhrScore !== null) return round1(rhrScore);
  if (hrvScore !== null) return round1(hrvScore);
  return null;
}

export function previousValidAverage(
  days: LoadRecoverySourceDay[],
  currentIndex: number,
  pick: (day: LoadRecoverySourceDay) => number | null,
) {
  const previousValues: number[] = [];

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const value = pick(days[index]);
    if (value !== null) {
      previousValues.push(value);
      if (previousValues.length === 14) break;
    }
  }

  if (previousValues.length === 0) return null;
  return average(previousValues);
}

export function coverageLabel(points: LoadRecoveryChartPoint[]) {
  return points.every((point) => point.hasHrv) ? "full" : "partial";
}

export function buildLoadRecoveryChartPayloadFromDays(
  days: LoadRecoverySourceDay[],
): LoadRecoveryChartPayload {
  const sortedDays = [...days].sort((left, right) => left.date.localeCompare(right.date));
  const points = sortedDays
    .map((day, index): LoadRecoveryChartPoint => {
      const rhrBaseline = previousValidAverage(
        sortedDays,
        index,
        (currentDay) => currentDay.restingHeartRate,
      );
      const hrvBaseline = previousValidAverage(
        sortedDays,
        index,
        (currentDay) => currentDay.hrvRmssd,
      );
      const rhrScore = scoreRestingHeartRate(day.restingHeartRate, rhrBaseline);
      const hrvScore = scoreHrv(day.hrvRmssd, hrvBaseline);

      return {
        date: day.date,
        load: calculateTrainingLoad(day),
        recovery: combineRecoveryScore({
          sleepScore: day.sleepScore,
          rhrScore,
          hrvScore,
        }),
        hasHrv: day.hrvRmssd !== null,
      };
    })
    .slice(-28);

  const recoveryPoints = points.filter((point) => point.recovery !== null);
  if (recoveryPoints.length < 7) {
    return {
      state: "empty",
      reason: "Need at least 7 recent recovery days before this chart becomes reliable.",
      points,
      summary: null,
    };
  }

  const trailing7 = points.slice(-7);
  const recoveryCoverage = coverageLabel(points);
  const highestLoadValue = Math.max(...points.map((point) => point.load));
  const highestLoadDate =
    [...points]
      .reverse()
      .find((point) => point.load === highestLoadValue)?.date ?? points[points.length - 1]?.date ?? "";
  const avgRecovery7d = averageOrNull(
    trailing7
      .map((point) => point.recovery)
      .filter((value): value is number => value !== null),
  );

  return {
    state: recoveryCoverage === "full" ? "ready" : "partial",
    points,
    summary: {
      avgLoad7d: round1(average(trailing7.map((point) => point.load))),
      avgRecovery7d: avgRecovery7d === null ? null : round1(avgRecovery7d),
      highestLoadDate,
      highestLoadValue,
      recoveryCoverage,
    },
  };
}

function emptySourceDay(date: Date): LoadRecoverySourceDay {
  return {
    date: format(date, "yyyy-MM-dd"),
    zone2Minutes: 0,
    cardioMinutes: null,
    peakMinutes: null,
    sleepScore: null,
    restingHeartRate: null,
    hrvRmssd: null,
  };
}

function buildSyntheticDemoSourceDays(from: Date, count: number, startIndex = 0) {
  return Array.from({ length: count }, (_, index) => ({
    ...emptySourceDay(addDays(from, index)),
    zone2Minutes: startIndex + index >= 35 ? (startIndex + index - 34) * 10 : 20,
    sleepScore: 90,
    hrvRmssd: (startIndex + index) % 3 === 0 ? null : 38 + ((startIndex + index) % 5) * 2,
  }));
}

function mapDemoDaysToSourceDays(days: DayDashboard[], startIndex = 0): LoadRecoverySourceDay[] {
  return days.map((day, index): LoadRecoverySourceDay => ({
    date: day.date,
    zone2Minutes: day.zone2Minutes,
    cardioMinutes: day.cardioMinutes,
    peakMinutes: day.peakMinutes,
    sleepScore: day.sleepScore,
    restingHeartRate: day.restingHeartRate,
    hrvRmssd: (startIndex + index) % 3 === 0 ? null : 38 + ((startIndex + index) % 5) * 2,
  }));
}

function buildDefaultSyntheticDemoHistory(today: Date) {
  const from = subDays(today, 41);

  return buildSyntheticDemoSourceDays(from, 42);
}

export async function getLoadRecoveryChartPayload(
  userId: string,
  sleepGoalHours = 8,
  sleepScoreMode: SleepScoreMode = "fitbit",
) {
  const today = startOfDay(new Date());
  const from = subDays(today, 89);
  const recoveryModel = (prisma as unknown as {
    dailyRecovery?: {
      findMany: (args: unknown) => Promise<Array<{ date: Date; hrvRmssd: number | null }>>;
    };
  }).dailyRecovery;

  const [zones, sleeps, recoveries] = await Promise.all([
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: from, lte: today } },
      select: {
        date: true,
        zone2Minutes: true,
        cardioMinutes: true,
        peakMinutes: true,
        restingHeartRate: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: from, lte: today } },
      select: {
        date: true,
        minutesAsleep: true,
        timeInBed: true,
        efficiency: true,
        deepMinutes: true,
        remMinutes: true,
        wakeMinutes: true,
      },
      orderBy: { date: "asc" },
    }),
    recoveryModel?.findMany
      ? recoveryModel.findMany({
          where: { userId, date: { gte: from, lte: today } },
          select: {
            date: true,
            hrvRmssd: true,
          },
          orderBy: { date: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const dayMap = new Map<string, LoadRecoverySourceDay>();
  for (let cursor = from; cursor <= today; cursor = addDays(cursor, 1)) {
    dayMap.set(format(cursor, "yyyy-MM-dd"), emptySourceDay(cursor));
  }

  for (const row of zones) {
    const item = dayMap.get(format(row.date, "yyyy-MM-dd"));
    if (!item) continue;
    item.zone2Minutes = row.zone2Minutes;
    item.cardioMinutes = row.cardioMinutes;
    item.peakMinutes = row.peakMinutes;
    item.restingHeartRate = row.restingHeartRate;
  }

  for (const row of sleeps) {
    const item = dayMap.get(format(row.date, "yyyy-MM-dd"));
    if (!item) continue;
    item.sleepScore = calculateSleepScoreDetailed(
      {
        minutesAsleep: row.minutesAsleep,
        timeInBed: row.timeInBed,
        efficiency: row.efficiency,
        deepMinutes: row.deepMinutes ?? 0,
        remMinutes: row.remMinutes ?? 0,
        wakeMinutes: row.wakeMinutes ?? 0,
      },
      sleepGoalHours,
      sleepScoreMode,
    ).total;
  }

  for (const row of recoveries) {
    const item = dayMap.get(format(row.date, "yyyy-MM-dd"));
    if (!item) continue;
    item.hrvRmssd = row.hrvRmssd;
  }

  return buildLoadRecoveryChartPayloadFromDays(Array.from(dayMap.values()));
}

export function buildDemoLoadRecoveryChartPayload(days: DayDashboard[]) {
  const today = startOfDay(new Date());
  const todayKey = format(today, "yyyy-MM-dd");
  const recentDays = [...days]
    .filter((day) => day.date <= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-42);

  if (recentDays.length === 0) {
    return buildLoadRecoveryChartPayloadFromDays(buildDefaultSyntheticDemoHistory(today));
  }

  const sourceDays =
    recentDays.length >= 28
      ? mapDemoDaysToSourceDays(recentDays)
      : [
          ...buildSyntheticDemoSourceDays(
            subDays(new Date(`${recentDays[0].date}T00:00:00.000Z`), 42 - recentDays.length),
            42 - recentDays.length,
          ),
          ...mapDemoDaysToSourceDays(recentDays, 42 - recentDays.length),
        ];

  return buildLoadRecoveryChartPayloadFromDays(sourceDays);
}
