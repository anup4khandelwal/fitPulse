import { addDays, format, parseISO } from "date-fns";

import { dateKeyToUtcDate, enumerateDateKeys } from "@/lib/date";
import { FitbitApiError, fitbitFetchWithAutoRefresh } from "@/lib/fitbit/client";
import { prisma } from "@/lib/prisma";

type SyncResult = {
  syncedDays: number;
  warnings: string[];
  rateLimited: boolean;
};

// ── Google Health API response types ─────────────────────────────────────────

type HealthDataPointsResponse<T> = {
  dataPoints?: T[];
  nextPageToken?: string;
};

type HealthStepsDataPoint = {
  steps?: { interval?: Interval; count?: string | number };
};

type HealthActiveZoneMinutesDataPoint = {
  activeZoneMinutes?: {
    interval?: Interval;
    fatBurnActiveZoneMinutes?: string | number;
    cardioActiveZoneMinutes?: string | number;
    peakActiveZoneMinutes?: string | number;
  };
};

type HealthSedentaryPeriodDataPoint = {
  sedentaryPeriod?: { interval?: Interval };
};

type HealthTotalCaloriesDataPoint = {
  totalCalories?: { interval?: Interval; caloriesKcal?: number };
};

type HealthSleepDataPoint = {
  sleep?: {
    interval?: Interval;
    type?: string;
    stages?: Array<{ startTime?: string; endTime?: string; type?: string }>;
    summary?: { minutesAsleep?: number; minutesInBed?: number };
    efficiency?: number;
    minutesAsleep?: number;
    minutesInBed?: number;
  };
};

type HealthDailyRhrDataPoint = {
  dailyRestingHeartRate?: { date?: string; beatsPerMinute?: number };
};

type HealthDailyHrzDataPoint = {
  dailyHeartRateZones?: {
    date?: string;
    heartRateZoneDurations?: {
      outOfRangeTime?: string;
      fatBurnTime?: string;
      lightTime?: string;
      cardioTime?: string;
      peakTime?: string;
    };
  };
};

type HealthDailyVo2MaxDataPoint = {
  dailyVo2Max?: { date?: string; vo2Max?: number };
};

type HealthDailyHrvDataPoint = {
  dailyHeartRateVariability?: { date?: string; averageHeartRateVariabilityMilliseconds?: number };
};

type HealthDailyRrDataPoint = {
  dailyRespiratoryRate?: { date?: string; breathsPerMinute?: number };
};

type HealthDailySpo2DataPoint = {
  dailyOxygenSaturation?: {
    date?: string;
    averagePercentage?: number;
    minPercentage?: number;
    maxPercentage?: number;
  };
};

type HealthDailyTempDataPoint = {
  dailySleepTemperatureDerivations?: { date?: string; nightlyTemperatureCelsius?: number };
};

type HealthExerciseDataPoint = {
  exercise?: {
    interval?: Interval;
    exerciseType?: string;
    metricsSummary?: {
      caloriesKcal?: number;
      distanceMillimiters?: number;
      steps?: string | number;
      activeDuration?: string;
    };
    displayName?: string;
    activeDuration?: string;
  };
};

type HealthWeightDataPoint = {
  weight?: { date?: string; massKg?: number; bmi?: number };
};

type HealthBodyFatDataPoint = {
  bodyFat?: { date?: string; percentage?: number };
};

type Interval = { startTime?: string; endTime?: string };

// ── Utilities ─────────────────────────────────────────────────────────────────

function parseDurationSec(d: string | undefined | null): number {
  if (!d) return 0;
  return parseInt(d.replace("s", ""), 10) || 0;
}

function toNum(v: string | number | undefined | null): number {
  if (v == null) return 0;
  return typeof v === "string" ? parseInt(v, 10) || 0 : v;
}

function intervalMinutes(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  return Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000);
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchAllDataPoints<T>(userId: string, dataType: string, filter: string): Promise<T[]> {
  const all: T[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ filter, pageSize: "10000" });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fitbitFetchWithAutoRefresh(
      userId,
      `/v4/users/me/dataTypes/${dataType}/dataPoints?${params}`,
    );

    if (response.status === 403) {
      throw new FitbitApiError(
        "Missing required Google Health API scopes. Reconnect and approve all requested scopes.",
        403,
      );
    }

    if (!response.ok) {
      throw new FitbitApiError(`Google Health API request failed (${response.status})`, response.status);
    }

    const body = (await response.json()) as HealthDataPointsResponse<T>;
    all.push(...(body.dataPoints ?? []));
    pageToken = body.nextPageToken || undefined;
  } while (pageToken);

  return all;
}

async function fetchOptionalDataPoints<T>(userId: string, dataType: string, filter: string): Promise<T[] | null> {
  try {
    return await fetchAllDataPoints<T>(userId, dataType, filter);
  } catch (error) {
    if (error instanceof FitbitApiError) {
      if (error.status === 429) throw error;
      return null;
    }
    return null;
  }
}

function dayFilter(snakeType: string, dateKey: string): string {
  const next = format(addDays(parseISO(dateKey), 1), "yyyy-MM-dd");
  return `${snakeType}.interval.civil_start_time >= "${dateKey}" AND ${snakeType}.interval.civil_start_time < "${next}"`;
}

function dailyFilter(snakeType: string, dateKey: string): string {
  return `${snakeType}.date = "${dateKey}"`;
}

// ── Per-day sync ──────────────────────────────────────────────────────────────

async function syncOneDate(userId: string, dateKey: string) {
  const next = format(addDays(parseISO(dateKey), 1), "yyyy-MM-dd");

  const [
    stepsPoints,
    azminPoints,
    sedentaryPoints,
    caloriesPoints,
    sleepPoints,
    rhrPoints,
    hrzPoints,
    vo2Points,
    hrvPoints,
    rrPoints,
    spo2Points,
    tempPoints,
    exercisePoints,
    weightPoints,
    bodyFatPoints,
  ] = await Promise.all([
    fetchAllDataPoints<HealthStepsDataPoint>(userId, "steps", dayFilter("steps", dateKey)),
    fetchOptionalDataPoints<HealthActiveZoneMinutesDataPoint>(
      userId,
      "active-zone-minutes",
      dayFilter("active_zone_minutes", dateKey),
    ),
    fetchOptionalDataPoints<HealthSedentaryPeriodDataPoint>(
      userId,
      "sedentary-period",
      dayFilter("sedentary_period", dateKey),
    ),
    fetchOptionalDataPoints<HealthTotalCaloriesDataPoint>(
      userId,
      "total-calories",
      dayFilter("total_calories", dateKey),
    ),
    fetchAllDataPoints<HealthSleepDataPoint>(
      userId,
      "sleep",
      `sleep.civil_end_time >= "${dateKey}" AND sleep.civil_end_time < "${next}"`,
    ),
    fetchOptionalDataPoints<HealthDailyRhrDataPoint>(
      userId,
      "daily-resting-heart-rate",
      dailyFilter("daily_resting_heart_rate", dateKey),
    ),
    fetchOptionalDataPoints<HealthDailyHrzDataPoint>(
      userId,
      "daily-heart-rate-zones",
      dailyFilter("daily_heart_rate_zones", dateKey),
    ),
    fetchOptionalDataPoints<HealthDailyVo2MaxDataPoint>(
      userId,
      "daily-vo2-max",
      dailyFilter("daily_vo2_max", dateKey),
    ),
    fetchOptionalDataPoints<HealthDailyHrvDataPoint>(
      userId,
      "daily-heart-rate-variability",
      dailyFilter("daily_heart_rate_variability", dateKey),
    ),
    fetchOptionalDataPoints<HealthDailyRrDataPoint>(
      userId,
      "daily-respiratory-rate",
      dailyFilter("daily_respiratory_rate", dateKey),
    ),
    fetchOptionalDataPoints<HealthDailySpo2DataPoint>(
      userId,
      "daily-oxygen-saturation",
      dailyFilter("daily_oxygen_saturation", dateKey),
    ),
    fetchOptionalDataPoints<HealthDailyTempDataPoint>(
      userId,
      "daily-sleep-temperature-derivations",
      dailyFilter("daily_sleep_temperature_derivations", dateKey),
    ),
    fetchOptionalDataPoints<HealthExerciseDataPoint>(
      userId,
      "exercise",
      `exercise.interval.civil_start_time >= "${dateKey}" AND exercise.interval.civil_start_time < "${next}"`,
    ),
    fetchOptionalDataPoints<HealthWeightDataPoint>(userId, "weight", dailyFilter("weight", dateKey)),
    fetchOptionalDataPoints<HealthBodyFatDataPoint>(userId, "body-fat", dailyFilter("body_fat", dateKey)),
  ]);

  // ── Steps ──────────────────────────────────────────────────────────────────
  const steps = stepsPoints.reduce((sum, p) => sum + toNum(p.steps?.count), 0);

  // ── Active zone minutes → activity intensity breakdown ────────────────────
  let fatBurnMins = 0;
  let cardioMins = 0;
  let peakMins = 0;
  for (const p of azminPoints ?? []) {
    fatBurnMins += toNum(p.activeZoneMinutes?.fatBurnActiveZoneMinutes);
    cardioMins += toNum(p.activeZoneMinutes?.cardioActiveZoneMinutes);
    peakMins += toNum(p.activeZoneMinutes?.peakActiveZoneMinutes);
  }
  const activeMinutes = fatBurnMins + cardioMins + peakMins;

  // ── Sedentary minutes ──────────────────────────────────────────────────────
  const sedentaryMinutes = (sedentaryPoints ?? []).reduce(
    (sum, p) => sum + intervalMinutes(p.sedentaryPeriod?.interval?.startTime, p.sedentaryPeriod?.interval?.endTime),
    0,
  );

  // ── Calories ───────────────────────────────────────────────────────────────
  const caloriesRaw = (caloriesPoints ?? []).reduce((sum, p) => sum + (p.totalCalories?.caloriesKcal ?? 0), 0);
  const caloriesOut = caloriesRaw > 0 ? Math.round(caloriesRaw) : null;

  // ── Sleep ──────────────────────────────────────────────────────────────────
  const sleepSession = sleepPoints[0]?.sleep;
  const stages = sleepSession?.stages ?? [];
  const hasStages = stages.length > 0;

  const stageMins = (type: string) =>
    hasStages
      ? Math.round(stages.filter((s) => s.type === type).reduce((sum, s) => sum + intervalMinutes(s.startTime, s.endTime), 0))
      : null;

  const deepMinutes = stageMins("DEEP");
  const lightMinutes = stageMins("LIGHT");
  const remMinutes = stageMins("REM");
  const wakeMinutes = stageMins("AWAKE");

  const minutesAsleep =
    sleepSession?.summary?.minutesAsleep ??
    sleepSession?.minutesAsleep ??
    (deepMinutes ?? 0) + (lightMinutes ?? 0) + (remMinutes ?? 0);

  const timeInBed =
    sleepSession?.summary?.minutesInBed ??
    sleepSession?.minutesInBed ??
    intervalMinutes(sleepSession?.interval?.startTime, sleepSession?.interval?.endTime);

  // ── Heart rate zones ───────────────────────────────────────────────────────
  const restingHeartRate = rhrPoints?.[0]?.dailyRestingHeartRate?.beatsPerMinute ?? null;

  const hrzDurations = hrzPoints?.[0]?.dailyHeartRateZones?.heartRateZoneDurations;
  // Prefer daily-heart-rate-zones when available; fall back to summed active-zone-minutes
  const zone2Minutes = hrzDurations
    ? Math.round(parseDurationSec(hrzDurations.fatBurnTime ?? hrzDurations.lightTime) / 60)
    : fatBurnMins;
  const cardioMinutes = hrzDurations ? Math.round(parseDurationSec(hrzDurations.cardioTime) / 60) : cardioMins;
  const peakMinutes = hrzDurations ? Math.round(parseDurationSec(hrzDurations.peakTime) / 60) : peakMins;
  const outOfRangeMinutes = hrzDurations
    ? Math.round(parseDurationSec(hrzDurations.outOfRangeTime) / 60)
    : null;

  // ── Recovery metrics ───────────────────────────────────────────────────────
  const vo2Data = vo2Points?.[0]?.dailyVo2Max;
  const hrvData = hrvPoints?.[0]?.dailyHeartRateVariability;
  const rrData = rrPoints?.[0]?.dailyRespiratoryRate;
  const spo2Data = spo2Points?.[0]?.dailyOxygenSaturation;
  const tempData = tempPoints?.[0]?.dailySleepTemperatureDerivations;

  // ── DB writes ──────────────────────────────────────────────────────────────
  const date = dateKeyToUtcDate(dateKey);

  const writes: Array<Promise<unknown>> = [
    prisma.dailySummary.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        steps,
        activeMinutes,
        sedentaryMinutes,
        lightlyActiveMins: fatBurnMins,
        fairlyActiveMins: cardioMins,
        veryActiveMins: peakMins,
        caloriesOut,
      },
      update: {
        steps,
        activeMinutes,
        sedentaryMinutes,
        lightlyActiveMins: fatBurnMins,
        fairlyActiveMins: cardioMins,
        veryActiveMins: peakMins,
        caloriesOut,
      },
    }),
    prisma.dailySleep.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        minutesAsleep,
        timeInBed,
        efficiency: sleepSession?.efficiency ?? 0,
        deepMinutes,
        remMinutes,
        lightMinutes,
        wakeMinutes,
        sleepStart: sleepSession?.interval?.startTime ? new Date(sleepSession.interval.startTime) : null,
        sleepEnd: sleepSession?.interval?.endTime ? new Date(sleepSession.interval.endTime) : null,
      },
      update: {
        minutesAsleep,
        timeInBed,
        efficiency: sleepSession?.efficiency ?? 0,
        deepMinutes,
        remMinutes,
        lightMinutes,
        wakeMinutes,
        sleepStart: sleepSession?.interval?.startTime ? new Date(sleepSession.interval.startTime) : null,
        sleepEnd: sleepSession?.interval?.endTime ? new Date(sleepSession.interval.endTime) : null,
      },
    }),
    prisma.dailyHeartZones.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        zone2Minutes,
        cardioMinutes,
        peakMinutes,
        outOfRangeMinutes,
        restingHeartRate: restingHeartRate != null ? Math.round(restingHeartRate) : null,
      },
      update: {
        zone2Minutes,
        cardioMinutes,
        peakMinutes,
        outOfRangeMinutes,
        restingHeartRate: restingHeartRate != null ? Math.round(restingHeartRate) : null,
      },
    }),
  ];

  const recoveryModel = (prisma as unknown as { dailyRecovery?: { upsert: (args: unknown) => Promise<unknown> } })
    .dailyRecovery;
  if (recoveryModel?.upsert) {
    writes.push(
      recoveryModel.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
          date,
          cardioFitnessScore: null,
          vo2Max: vo2Data?.vo2Max ?? null,
          hrvRmssd: hrvData?.averageHeartRateVariabilityMilliseconds ?? null,
          hrvDeepRmssd: null,
          breathingRate: rrData?.breathsPerMinute ?? null,
          spo2Avg: spo2Data?.averagePercentage ?? null,
          spo2Min: spo2Data?.minPercentage ?? null,
          spo2Max: spo2Data?.maxPercentage ?? null,
          skinTempC: tempData?.nightlyTemperatureCelsius ?? null,
          coreTempC: null,
        },
        update: {
          cardioFitnessScore: null,
          vo2Max: vo2Data?.vo2Max ?? null,
          hrvRmssd: hrvData?.averageHeartRateVariabilityMilliseconds ?? null,
          hrvDeepRmssd: null,
          breathingRate: rrData?.breathsPerMinute ?? null,
          spo2Avg: spo2Data?.averagePercentage ?? null,
          spo2Min: spo2Data?.minPercentage ?? null,
          spo2Max: spo2Data?.maxPercentage ?? null,
          skinTempC: tempData?.nightlyTemperatureCelsius ?? null,
          coreTempC: null,
        },
      }),
    );
  }

  const weightKg = weightPoints?.[0]?.weight?.massKg ?? null;
  const bmi = weightPoints?.[0]?.weight?.bmi ?? null;
  const bodyFatPct = bodyFatPoints?.[0]?.bodyFat?.percentage ?? null;

  if (weightKg != null) {
    writes.push(
      prisma.weightLog.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, weightKg, bmi, bodyFatPct },
        update: { weightKg, bmi, bodyFatPct },
      }),
    );
  }

  await Promise.all(writes);
  await syncActivitiesForDate(userId, dateKey, exercisePoints ?? []);
}

async function syncActivitiesForDate(userId: string, dateKey: string, exercisePoints: HealthExerciseDataPoint[]) {
  const dayStart = parseISO(`${dateKey}T00:00:00.000Z`);
  const dayEnd = addDays(dayStart, 1);

  const activities = exercisePoints
    .filter((p) => Boolean(p.exercise?.interval?.startTime))
    .map((p) => {
      const ex = p.exercise!;
      const startTime = new Date(ex.interval!.startTime!);
      const durationSec = parseDurationSec(ex.activeDuration ?? ex.metricsSummary?.activeDuration);
      return { startTime, ex, durationMinutes: Math.max(1, Math.round(durationSec / 60)) };
    })
    .filter(({ startTime }) => startTime >= dayStart && startTime < dayEnd);

  await prisma.activityLog.deleteMany({
    where: { userId, startTime: { gte: dayStart, lt: dayEnd } },
  });

  if (activities.length === 0) return;

  await prisma.activityLog.createMany({
    data: activities.map(({ startTime, ex, durationMinutes }) => ({
      userId,
      startTime,
      activityName: ex.displayName ?? ex.exerciseType ?? "Activity",
      durationMinutes,
      calories: ex.metricsSummary?.caloriesKcal != null ? Math.round(ex.metricsSummary.caloriesKcal) : null,
      // API returns millimeters; store as km (1 mm = 0.000001 km)
      distance: ex.metricsSummary?.distanceMillimiters != null ? ex.metricsSummary.distanceMillimiters / 1_000_000 : null,
      steps: toNum(ex.metricsSummary?.steps) || null,
    })),
  });
}

export async function syncDateRange(
  userId: string,
  from: string,
  to: string,
  options?: { failFast?: boolean },
): Promise<SyncResult> {
  const dateKeys = enumerateDateKeys(from, to);
  const warnings: string[] = [];
  let syncedDays = 0;
  let rateLimited = false;

  for (const dateKey of dateKeys) {
    try {
      await syncOneDate(userId, dateKey);
      syncedDays += 1;
    } catch (error) {
      if (error instanceof FitbitApiError && error.status === 429) {
        rateLimited = true;
        warnings.push(
          error.retryAfterSec
            ? `Rate limit reached. Retry in about ${error.retryAfterSec} seconds.`
            : "Rate limit reached. Retry in a few minutes.",
        );
        if (options?.failFast) {
          throw error;
        }
        break;
      }
      if (
        options?.failFast &&
        error instanceof FitbitApiError &&
        (error.status === 408 || error.status >= 500)
      ) {
        throw error;
      }
      if (options?.failFast && !(error instanceof FitbitApiError)) {
        throw error;
      }
      warnings.push(`Failed syncing ${dateKey}.`);
    }
  }

  return { syncedDays, warnings, rateLimited };
}
