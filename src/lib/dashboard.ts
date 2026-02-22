import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

import { prisma } from "@/lib/prisma";
import { calculateSleepScoreDetailed, type SleepScoreBreakdown, type SleepScoreMode } from "@/lib/sleep-score";

export type DayDashboard = {
  date: string;
  steps: number;
  activeMinutes: number;
  sedentaryMinutes: number;
  lightlyActiveMins: number;
  fairlyActiveMins: number;
  veryActiveMins: number;
  sleepMinutes: number;
  sleepScore: number | null;
  sleepScoreBreakdown: SleepScoreBreakdown | null;
  zone2Minutes: number;
  cardioMinutes: number;
  peakMinutes: number;
  outOfRangeMinutes: number;
  restingHeartRate: number | null;
  hasActivity: boolean;
  activities: Array<{
    id: string;
    name: string;
    startTime: string;
    durationMinutes: number;
    calories: number | null;
    distance: number | null;
    steps: number | null;
  }>;
  sleep: {
    minutesAsleep: number;
    timeInBed: number;
    efficiency: number;
    deepMinutes: number | null;
    remMinutes: number | null;
    lightMinutes: number | null;
    wakeMinutes: number | null;
    sleepStart: string | null;
    sleepEnd: string | null;
  } | null;
};

export type WeeklySummary = {
  totalZone2Minutes: number;
  averageSleepHours: number;
  averageSteps: number;
  averageActiveMinutes: number;
  averageSedentaryHours: number;
  zone2DaysCount: number;
};

export type CalendarPayload = {
  month: string;
  startDate: string;
  endDate: string;
  days: DayDashboard[];
  weeklySummary: WeeklySummary;
};

type TrendMetric = {
  current: number;
  baseline: number;
  delta: number;
  deltaPct: number | null;
};

export type TrendWindow = {
  days: 7 | 30 | 90;
  zone2Total: TrendMetric;
  avgSleepHours: TrendMetric;
  avgSteps: TrendMetric;
  avgRestingHeartRate: TrendMetric;
};

export type TrendPayload = {
  windows: TrendWindow[];
};

export type CorrelationInsight = {
  id: string;
  title: string;
  detail: string;
  r: number;
  confidence: "low" | "medium" | "high";
  direction: "positive" | "negative";
  sampleSize: number;
};

function emptyDay(date: Date): DayDashboard {
  return {
    date: format(date, "yyyy-MM-dd"),
    steps: 0,
    activeMinutes: 0,
    sedentaryMinutes: 0,
    lightlyActiveMins: 0,
    fairlyActiveMins: 0,
    veryActiveMins: 0,
    sleepMinutes: 0,
    sleepScore: null,
    sleepScoreBreakdown: null,
    zone2Minutes: 0,
    cardioMinutes: 0,
    peakMinutes: 0,
    outOfRangeMinutes: 0,
    restingHeartRate: null,
    hasActivity: false,
    activities: [],
    sleep: null,
  };
}

export async function getOrCreateSingleUser() {
  const existing = await prisma.user.findFirst();
  if (existing) return existing;
  return prisma.user.create({ data: {} });
}

export async function getCalendarPayload(
  monthKey?: string,
  sleepGoalHours = 8,
  sleepScoreMode: SleepScoreMode = "fitbit",
): Promise<CalendarPayload> {
  const user = await getOrCreateSingleUser();
  const month = monthKey ? parse(monthKey, "yyyy-MM", new Date()) : new Date();

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const [summaries, sleeps, zones, activities] = await Promise.all([
    prisma.dailySummary.findMany({
      where: { userId: user.id, date: { gte: gridStart, lte: gridEnd } },
    }),
    prisma.dailySleep.findMany({
      where: { userId: user.id, date: { gte: gridStart, lte: gridEnd } },
    }),
    prisma.dailyHeartZones.findMany({
      where: { userId: user.id, date: { gte: gridStart, lte: gridEnd } },
    }),
    prisma.activityLog.findMany({
      where: { userId: user.id, startTime: { gte: gridStart, lte: addDays(gridEnd, 1) } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const dayMap = new Map<string, DayDashboard>();
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    dayMap.set(format(cursor, "yyyy-MM-dd"), emptyDay(cursor));
  }

  for (const item of summaries) {
    const day = dayMap.get(format(item.date, "yyyy-MM-dd"));
    if (day) {
      day.steps = item.steps;
      day.activeMinutes = item.activeMinutes;
      day.sedentaryMinutes = item.sedentaryMinutes;
      day.lightlyActiveMins = item.lightlyActiveMins;
      day.fairlyActiveMins = item.fairlyActiveMins;
      day.veryActiveMins = item.veryActiveMins;
    }
  }

  for (const item of sleeps) {
    const day = dayMap.get(format(item.date, "yyyy-MM-dd"));
    if (!day) continue;
    day.sleepMinutes = item.minutesAsleep;
    const scoreBreakdown = calculateSleepScoreDetailed(
      {
        minutesAsleep: item.minutesAsleep,
        timeInBed: item.timeInBed,
        efficiency: item.efficiency,
        deepMinutes: item.deepMinutes ?? 0,
        remMinutes: item.remMinutes ?? 0,
        wakeMinutes: item.wakeMinutes ?? 0,
      },
      sleepGoalHours,
      sleepScoreMode,
    );
    day.sleepScore = scoreBreakdown.total;
    day.sleepScoreBreakdown = scoreBreakdown;
    day.sleep = {
      minutesAsleep: item.minutesAsleep,
      timeInBed: item.timeInBed,
      efficiency: item.efficiency,
      deepMinutes: item.deepMinutes,
      remMinutes: item.remMinutes,
      lightMinutes: item.lightMinutes,
      wakeMinutes: item.wakeMinutes,
      sleepStart: item.sleepStart?.toISOString() ?? null,
      sleepEnd: item.sleepEnd?.toISOString() ?? null,
    };
  }

  for (const item of zones) {
    const day = dayMap.get(format(item.date, "yyyy-MM-dd"));
    if (!day) continue;
    day.zone2Minutes = item.zone2Minutes;
    day.cardioMinutes = item.cardioMinutes ?? 0;
    day.peakMinutes = item.peakMinutes ?? 0;
    day.outOfRangeMinutes = item.outOfRangeMinutes ?? 0;
    day.restingHeartRate = item.restingHeartRate;
  }

  for (const activity of activities) {
    const day = dayMap.get(format(activity.startTime, "yyyy-MM-dd"));
    if (!day) continue;
    day.hasActivity = true;
    day.activities.push({
      id: activity.id,
      name: activity.activityName,
      startTime: activity.startTime.toISOString(),
      durationMinutes: activity.durationMinutes,
      calories: activity.calories,
      distance: activity.distance,
      steps: activity.steps,
    });
  }

  const weekEnd = new Date();
  const weekStart = subDays(weekEnd, 6);

  const [weeklySleeps, weeklyZones, weeklySteps] = await Promise.all([
    prisma.dailySleep.findMany({ where: { userId: user.id, date: { gte: weekStart, lte: weekEnd } } }),
    prisma.dailyHeartZones.findMany({ where: { userId: user.id, date: { gte: weekStart, lte: weekEnd } } }),
    prisma.dailySummary.findMany({ where: { userId: user.id, date: { gte: weekStart, lte: weekEnd } } }),
  ]);

  return {
    month: format(month, "yyyy-MM"),
    startDate: format(gridStart, "yyyy-MM-dd"),
    endDate: format(gridEnd, "yyyy-MM-dd"),
    days: Array.from(dayMap.values()),
    weeklySummary: {
      totalZone2Minutes: weeklyZones.reduce((acc, v) => acc + v.zone2Minutes, 0),
      averageSleepHours:
        weeklySleeps.length > 0
          ? weeklySleeps.reduce((acc, v) => acc + v.minutesAsleep, 0) / weeklySleeps.length / 60
          : 0,
      averageSteps:
        weeklySteps.length > 0 ? Math.round(weeklySteps.reduce((acc, v) => acc + v.steps, 0) / weeklySteps.length) : 0,
      averageActiveMinutes:
        weeklySteps.length > 0
          ? Math.round(weeklySteps.reduce((acc, v) => acc + v.activeMinutes, 0) / weeklySteps.length)
          : 0,
      averageSedentaryHours:
        weeklySteps.length > 0
          ? Number((weeklySteps.reduce((acc, v) => acc + v.sedentaryMinutes, 0) / weeklySteps.length / 60).toFixed(1))
          : 0,
      zone2DaysCount: weeklyZones.filter((v) => v.zone2Minutes > 0).length,
    },
  };
}

function safeAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function buildTrendMetric(current: number, baseline: number): TrendMetric {
  const delta = current - baseline;
  const deltaPct = baseline === 0 ? null : (delta / baseline) * 100;
  return { current, baseline, delta, deltaPct };
}

function inRange(date: Date, from: Date, to: Date) {
  const value = date.getTime();
  return value >= from.getTime() && value <= to.getTime();
}

export async function getTrendPayload(userId: string): Promise<TrendPayload> {
  const today = startOfDay(new Date());
  const earliest = subDays(today, 179);

  const [summaries, sleeps, zones] = await Promise.all([
    prisma.dailySummary.findMany({
      where: { userId, date: { gte: earliest, lte: today } },
      select: { date: true, steps: true },
    }),
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: earliest, lte: today } },
      select: { date: true, minutesAsleep: true },
    }),
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: earliest, lte: today } },
      select: { date: true, zone2Minutes: true, restingHeartRate: true },
    }),
  ]);

  const windows: Array<7 | 30 | 90> = [7, 30, 90];
  const payload: TrendWindow[] = windows.map((days) => {
    const currentStart = subDays(today, days - 1);
    const baselineEnd = subDays(currentStart, 1);
    const baselineStart = subDays(currentStart, days);

    const currentSummaries = summaries.filter((row) => inRange(row.date, currentStart, today));
    const baselineSummaries = summaries.filter((row) => inRange(row.date, baselineStart, baselineEnd));

    const currentSleeps = sleeps.filter((row) => inRange(row.date, currentStart, today));
    const baselineSleeps = sleeps.filter((row) => inRange(row.date, baselineStart, baselineEnd));

    const currentZones = zones.filter((row) => inRange(row.date, currentStart, today));
    const baselineZones = zones.filter((row) => inRange(row.date, baselineStart, baselineEnd));

    const currentSteps = safeAverage(currentSummaries.map((row) => row.steps));
    const baselineSteps = safeAverage(baselineSummaries.map((row) => row.steps));

    const currentSleepHours = safeAverage(currentSleeps.map((row) => row.minutesAsleep)) / 60;
    const baselineSleepHours = safeAverage(baselineSleeps.map((row) => row.minutesAsleep)) / 60;

    const currentZone2 = currentZones.reduce((acc, row) => acc + row.zone2Minutes, 0);
    const baselineZone2 = baselineZones.reduce((acc, row) => acc + row.zone2Minutes, 0);

    const currentRestingHr = safeAverage(
      currentZones.map((row) => row.restingHeartRate).filter((value): value is number => value !== null),
    );
    const baselineRestingHr = safeAverage(
      baselineZones.map((row) => row.restingHeartRate).filter((value): value is number => value !== null),
    );

    return {
      days,
      zone2Total: buildTrendMetric(currentZone2, baselineZone2),
      avgSleepHours: buildTrendMetric(currentSleepHours, baselineSleepHours),
      avgSteps: buildTrendMetric(currentSteps, baselineSteps),
      avgRestingHeartRate: buildTrendMetric(currentRestingHr, baselineRestingHr),
    };
  });

  return { windows: payload };
}

function correlationCoefficient(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length);
  if (n < 8) return null;

  const mx = xs.reduce((acc, v) => acc + v, 0) / n;
  const my = ys.reduce((acc, v) => acc + v, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  if (sumSqX === 0 || sumSqY === 0) return null;
  return numerator / Math.sqrt(sumSqX * sumSqY);
}

function confidenceFor(absR: number, n: number): "low" | "medium" | "high" {
  if (n >= 45 && absR >= 0.45) return "high";
  if (n >= 20 && absR >= 0.25) return "medium";
  return "low";
}

function buildInsight(
  id: string,
  title: string,
  xLabel: string,
  yLabel: string,
  x: number[],
  y: number[],
): CorrelationInsight | null {
  const r = correlationCoefficient(x, y);
  if (r === null || Number.isNaN(r)) return null;
  if (Math.abs(r) < 0.15) return null;

  const direction = r >= 0 ? "positive" : "negative";
  const sampleSize = Math.min(x.length, y.length);
  const confidence = confidenceFor(Math.abs(r), sampleSize);
  const relation = direction === "positive" ? "increase together" : "move in opposite directions";

  return {
    id,
    title,
    detail: `${xLabel} and ${yLabel} ${relation} (r=${r.toFixed(2)}, n=${sampleSize}).`,
    r,
    confidence,
    direction,
    sampleSize,
  };
}

export async function getCorrelationInsights(userId: string): Promise<CorrelationInsight[]> {
  const today = startOfDay(new Date());
  const earliest = subDays(today, 89);

  const [summaries, sleeps, zones] = await Promise.all([
    prisma.dailySummary.findMany({
      where: { userId, date: { gte: earliest, lte: today } },
      select: { date: true, steps: true },
    }),
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: earliest, lte: today } },
      select: { date: true, minutesAsleep: true },
    }),
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: earliest, lte: today } },
      select: { date: true, zone2Minutes: true, restingHeartRate: true },
    }),
  ]);

  const dayMap = new Map<
    string,
    { steps?: number; sleepHours?: number; zone2?: number; restingHr?: number | null }
  >();

  for (const row of summaries) {
    const key = format(row.date, "yyyy-MM-dd");
    const item = dayMap.get(key) ?? {};
    item.steps = row.steps;
    dayMap.set(key, item);
  }

  for (const row of sleeps) {
    const key = format(row.date, "yyyy-MM-dd");
    const item = dayMap.get(key) ?? {};
    item.sleepHours = row.minutesAsleep / 60;
    dayMap.set(key, item);
  }

  for (const row of zones) {
    const key = format(row.date, "yyyy-MM-dd");
    const item = dayMap.get(key) ?? {};
    item.zone2 = row.zone2Minutes;
    item.restingHr = row.restingHeartRate;
    dayMap.set(key, item);
  }

  const sleepVsStepsX: number[] = [];
  const sleepVsStepsY: number[] = [];
  const sleepVsZone2X: number[] = [];
  const sleepVsZone2Y: number[] = [];
  const zone2VsHrX: number[] = [];
  const zone2VsHrY: number[] = [];

  for (const row of dayMap.values()) {
    if (typeof row.sleepHours === "number" && typeof row.steps === "number") {
      sleepVsStepsX.push(row.sleepHours);
      sleepVsStepsY.push(row.steps);
    }
    if (typeof row.sleepHours === "number" && typeof row.zone2 === "number") {
      sleepVsZone2X.push(row.sleepHours);
      sleepVsZone2Y.push(row.zone2);
    }
    if (typeof row.zone2 === "number" && typeof row.restingHr === "number") {
      zone2VsHrX.push(row.zone2);
      zone2VsHrY.push(row.restingHr);
    }
  }

  const insights = [
    buildInsight(
      "sleep-steps",
      "Sleep vs Steps",
      "sleep duration",
      "daily steps",
      sleepVsStepsX,
      sleepVsStepsY,
    ),
    buildInsight(
      "sleep-zone2",
      "Sleep vs Zone 2",
      "sleep duration",
      "zone 2 minutes",
      sleepVsZone2X,
      sleepVsZone2Y,
    ),
    buildInsight(
      "zone2-rhr",
      "Zone 2 vs Resting HR",
      "zone 2 minutes",
      "resting heart rate",
      zone2VsHrX,
      zone2VsHrY,
    ),
  ].filter((item): item is CorrelationInsight => Boolean(item));

  if (insights.length === 0) {
    return [
      {
        id: "insufficient-data",
        title: "Not enough stable signal yet",
        detail: "Keep syncing daily. Correlation insights unlock once there is enough variation and sample size.",
        r: 0,
        confidence: "low",
        direction: "positive",
        sampleSize: dayMap.size,
      },
    ];
  }

  return insights.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

export function buildDemoCalendarPayload(
  monthKey?: string,
  sleepGoalHours = 8,
  sleepScoreMode: SleepScoreMode = "fitbit",
): CalendarPayload {
  const month = monthKey ? parse(monthKey, "yyyy-MM", new Date()) : new Date();
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: DayDashboard[] = [];

  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const day = new Date(d);
    const dayIndex = Number(format(day, "d"));
    const isPast = day <= new Date();

    const zone2Minutes = isPast ? (dayIndex * 7) % 72 : 0;
    const steps = isPast ? 4500 + (dayIndex * 631) % 9000 : 0;
    const activeMinutes = isPast ? 32 + ((dayIndex * 3) % 58) : 0;
    const sleepMinutes = isPast ? 340 + (dayIndex * 13) % 140 : 0;
    const veryActiveMins = isPast ? Math.max(0, Math.round(activeMinutes * 0.18)) : 0;
    const fairlyActiveMins = isPast ? Math.max(0, Math.round(activeMinutes * 0.27)) : 0;
    const lightlyActiveMins = isPast ? Math.max(0, activeMinutes - veryActiveMins - fairlyActiveMins) : 0;
    const sedentaryMinutes = isPast ? Math.max(0, 24 * 60 - sleepMinutes - activeMinutes) : 0;

    const sleepStart = new Date(day);
    sleepStart.setHours(22, 45, 0, 0);
    const sleepEnd = addDays(new Date(day), 1);
    sleepEnd.setHours(6, 45, 0, 0);

    const activityTime = new Date(day);
    activityTime.setHours(7, 0, 0, 0);

    days.push({
      ...emptyDay(day),
      date: format(day, "yyyy-MM-dd"),
      zone2Minutes,
      cardioMinutes: isPast ? Math.max(0, zone2Minutes - 18) : 0,
      peakMinutes: isPast ? Math.max(0, Math.floor(zone2Minutes / 4) - 2) : 0,
      outOfRangeMinutes: isPast ? 80 + (dayIndex % 20) : 0,
      steps,
      activeMinutes,
      sedentaryMinutes,
      lightlyActiveMins,
      fairlyActiveMins,
      veryActiveMins,
      sleepMinutes,
      sleepScore: isPast
        ? calculateSleepScoreDetailed(
            {
              minutesAsleep: sleepMinutes,
              timeInBed: sleepMinutes + 42,
              efficiency: 91,
              deepMinutes: Math.round(sleepMinutes * 0.18),
              remMinutes: Math.round(sleepMinutes * 0.22),
              wakeMinutes: Math.round(sleepMinutes * 0.07),
            },
            sleepGoalHours,
            sleepScoreMode,
          ).total
        : null,
      sleepScoreBreakdown: isPast
        ? calculateSleepScoreDetailed(
            {
              minutesAsleep: sleepMinutes,
              timeInBed: sleepMinutes + 42,
              efficiency: 91,
              deepMinutes: Math.round(sleepMinutes * 0.18),
              remMinutes: Math.round(sleepMinutes * 0.22),
              wakeMinutes: Math.round(sleepMinutes * 0.07),
            },
            sleepGoalHours,
            sleepScoreMode,
          )
        : null,
      restingHeartRate: isPast ? 56 + (dayIndex % 6) : null,
      hasActivity: isPast && dayIndex % 2 === 0,
      activities:
        isPast && dayIndex % 2 === 0
          ? [
              {
                id: `${dayIndex}-a`,
                name: "Brisk Walk",
                startTime: activityTime.toISOString(),
                durationMinutes: 38,
                calories: 240,
                distance: 3.4,
                steps: 4500,
              },
            ]
          : [],
      sleep: {
        minutesAsleep: sleepMinutes,
        timeInBed: sleepMinutes + 42,
        efficiency: 91,
        deepMinutes: Math.round(sleepMinutes * 0.18),
        remMinutes: Math.round(sleepMinutes * 0.22),
        lightMinutes: Math.round(sleepMinutes * 0.53),
        wakeMinutes: Math.round(sleepMinutes * 0.07),
        sleepStart: sleepStart.toISOString(),
        sleepEnd: sleepEnd.toISOString(),
      },
    });
  }

  return {
    month: format(month, "yyyy-MM"),
    startDate: format(gridStart, "yyyy-MM-dd"),
    endDate: format(gridEnd, "yyyy-MM-dd"),
    days,
    weeklySummary: {
      totalZone2Minutes: 196,
      averageSleepHours: 7.1,
      averageSteps: 8430,
      averageActiveMinutes: 71,
      averageSedentaryHours: 14.6,
      zone2DaysCount: 5,
    },
  };
}

function demoTrendMetric(current: number, changePct: number): TrendMetric {
  const baseline = current / (1 + changePct / 100);
  return buildTrendMetric(current, baseline);
}

export function buildDemoTrendPayload(): TrendPayload {
  return {
    windows: [
      {
        days: 7,
        zone2Total: demoTrendMetric(214, 12.4),
        avgSleepHours: demoTrendMetric(7.2, 3.8),
        avgSteps: demoTrendMetric(8940, 7.1),
        avgRestingHeartRate: demoTrendMetric(57.8, -2.4),
      },
      {
        days: 30,
        zone2Total: demoTrendMetric(876, 9.2),
        avgSleepHours: demoTrendMetric(7.0, 2.1),
        avgSteps: demoTrendMetric(8320, 4.9),
        avgRestingHeartRate: demoTrendMetric(58.3, -1.8),
      },
      {
        days: 90,
        zone2Total: demoTrendMetric(2415, 14.6),
        avgSleepHours: demoTrendMetric(6.9, 1.6),
        avgSteps: demoTrendMetric(8015, 6.4),
        avgRestingHeartRate: demoTrendMetric(59.1, -3.2),
      },
    ],
  };
}

export function buildDemoCorrelationInsights(): CorrelationInsight[] {
  return [
    {
      id: "sleep-steps",
      title: "Sleep vs Steps",
      detail: "Sleep duration and daily steps increase together (r=0.42, n=63).",
      r: 0.42,
      confidence: "medium",
      direction: "positive",
      sampleSize: 63,
    },
    {
      id: "sleep-zone2",
      title: "Sleep vs Zone 2",
      detail: "Sleep duration and zone 2 minutes increase together (r=0.31, n=58).",
      r: 0.31,
      confidence: "medium",
      direction: "positive",
      sampleSize: 58,
    },
    {
      id: "zone2-rhr",
      title: "Zone 2 vs Resting HR",
      detail: "Zone 2 minutes and resting heart rate move in opposite directions (r=-0.37, n=55).",
      r: -0.37,
      confidence: "medium",
      direction: "negative",
      sampleSize: 55,
    },
  ];
}
