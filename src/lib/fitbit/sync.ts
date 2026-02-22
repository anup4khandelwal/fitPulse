import { addDays, parseISO } from "date-fns";

import { dateKeyToUtcDate, enumerateDateKeys } from "@/lib/date";
import { FitbitApiError, fitbitFetchWithAutoRefresh } from "@/lib/fitbit/client";
import { prisma } from "@/lib/prisma";

type SyncResult = {
  syncedDays: number;
  warnings: string[];
  rateLimited: boolean;
};

type HeartZone = {
  name: string;
  minutes: number;
};

type FitbitActivitySummary = {
  summary?: {
    steps?: number;
    sedentaryMinutes?: number;
    veryActiveMinutes?: number;
    fairlyActiveMinutes?: number;
    lightlyActiveMinutes?: number;
    caloriesOut?: number;
  };
};

type FitbitSleepResponse = {
  summary?: {
    totalMinutesAsleep?: number;
    totalTimeInBed?: number;
    stages?: {
      deep?: number;
      light?: number;
      rem?: number;
      wake?: number;
    };
  };
  sleep?: Array<{
    startTime?: string;
    endTime?: string;
    efficiency?: number;
    minutesAsleep?: number;
    timeInBed?: number;
  }>;
};

type FitbitHeartResponse = {
  "activities-heart"?: Array<{
    value?: {
      restingHeartRate?: number;
      heartRateZones?: HeartZone[];
    };
  }>;
};

type FitbitActivitiesListResponse = {
  activities?: Array<{
    activityName?: string;
    startTime?: string;
    duration?: number;
    calories?: number;
    steps?: number;
    distance?: number;
  }>;
};

type FitbitCardioScoreResponse = {
  cardioscore?: Array<{
    value?: {
      vo2Max?: number;
      cardioFitnessScore?: number;
    };
  }>;
};

type FitbitHrvResponse = {
  hrv?: Array<{
    value?: {
      dailyRmssd?: number;
      deepRmssd?: number;
    };
  }>;
};

type FitbitBreathingRateResponse = {
  br?: Array<{
    value?: {
      breathingRate?: number;
    };
  }>;
};

type FitbitSpo2Response = {
  value?: {
    avg?: number;
    min?: number;
    max?: number;
  };
};

type FitbitTempResponse = {
  tempSkin?: Array<{
    value?: {
      nightlyRelative?: number;
    };
  }>;
  tempCore?: Array<{
    value?: {
      value?: number;
    };
  }>;
};

async function fetchJson<T>(userId: string, path: string) {
  const response = await fitbitFetchWithAutoRefresh(userId, path);

  if (response.status === 403) {
    throw new FitbitApiError("Missing required Fitbit scopes. Reconnect and approve all requested scopes.", 403);
  }

  if (!response.ok) {
    throw new FitbitApiError(`Fitbit request failed (${response.status})`, response.status);
  }

  return (await response.json()) as T;
}

async function fetchOptionalJson<T>(userId: string, path: string) {
  try {
    return await fetchJson<T>(userId, path);
  } catch (error) {
    if (error instanceof FitbitApiError) {
      if (error.status === 429) {
        throw error;
      }
      return null;
    }
    return null;
  }
}

async function syncOneDate(userId: string, dateKey: string) {
  const [activityRes, sleepRes, heartRes, cardioRes, hrvRes, brRes, spo2Res, skinTempRes, coreTempRes] = await Promise.all([
    fetchJson<FitbitActivitySummary>(userId, `/1/user/-/activities/date/${dateKey}.json`),
    fetchJson<FitbitSleepResponse>(userId, `/1.2/user/-/sleep/date/${dateKey}.json`),
    fetchJson<FitbitHeartResponse>(userId, `/1/user/-/activities/heart/date/${dateKey}/1d.json`),
    fetchOptionalJson<FitbitCardioScoreResponse>(userId, `/1/user/-/cardioscore/date/${dateKey}.json`),
    fetchOptionalJson<FitbitHrvResponse>(userId, `/1/user/-/hrv/date/${dateKey}.json`),
    fetchOptionalJson<FitbitBreathingRateResponse>(userId, `/1/user/-/br/date/${dateKey}.json`),
    fetchOptionalJson<FitbitSpo2Response>(userId, `/1/user/-/spo2/date/${dateKey}.json`),
    fetchOptionalJson<FitbitTempResponse>(userId, `/1/user/-/temp/skin/date/${dateKey}.json`),
    fetchOptionalJson<FitbitTempResponse>(userId, `/1/user/-/temp/core/date/${dateKey}.json`),
  ]);

  const dailyActivity = activityRes.summary;
  const activeMinutes =
    (dailyActivity?.veryActiveMinutes ?? 0) +
    (dailyActivity?.fairlyActiveMinutes ?? 0) +
    (dailyActivity?.lightlyActiveMinutes ?? 0);

  const sleepMain = sleepRes.sleep?.[0];
  const sleepSummary = sleepRes.summary;
  const stages = sleepSummary?.stages;

  const heartValue = heartRes["activities-heart"]?.[0]?.value;
  const zones = heartValue?.heartRateZones ?? [];

  const zone2 = zones.find((z) => z.name === "Fat Burn")?.minutes ?? 0;
  const cardio = zones.find((z) => z.name === "Cardio")?.minutes ?? 0;
  const peak = zones.find((z) => z.name === "Peak")?.minutes ?? 0;
  const outOfRange = zones.find((z) => z.name === "Out of Range")?.minutes ?? 0;

  const date = dateKeyToUtcDate(dateKey);

  const cardioValue = cardioRes?.cardioscore?.[0]?.value;
  const hrvValue = hrvRes?.hrv?.[0]?.value;
  const brValue = brRes?.br?.[0]?.value;
  const spo2Value = spo2Res?.value;
  const skinTempValue = skinTempRes?.tempSkin?.[0]?.value;
  const coreTempValue = coreTempRes?.tempCore?.[0]?.value;
  const writes: Array<Promise<unknown>> = [
    prisma.dailySummary.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        steps: dailyActivity?.steps ?? 0,
        activeMinutes,
        sedentaryMinutes: dailyActivity?.sedentaryMinutes ?? 0,
        lightlyActiveMins: dailyActivity?.lightlyActiveMinutes ?? 0,
        fairlyActiveMins: dailyActivity?.fairlyActiveMinutes ?? 0,
        veryActiveMins: dailyActivity?.veryActiveMinutes ?? 0,
        caloriesOut: dailyActivity?.caloriesOut ?? null,
      },
      update: {
        steps: dailyActivity?.steps ?? 0,
        activeMinutes,
        sedentaryMinutes: dailyActivity?.sedentaryMinutes ?? 0,
        lightlyActiveMins: dailyActivity?.lightlyActiveMinutes ?? 0,
        fairlyActiveMins: dailyActivity?.fairlyActiveMinutes ?? 0,
        veryActiveMins: dailyActivity?.veryActiveMinutes ?? 0,
        caloriesOut: dailyActivity?.caloriesOut ?? null,
      },
    }),
    prisma.dailySleep.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        minutesAsleep: sleepSummary?.totalMinutesAsleep ?? sleepMain?.minutesAsleep ?? 0,
        timeInBed: sleepSummary?.totalTimeInBed ?? sleepMain?.timeInBed ?? 0,
        efficiency: sleepMain?.efficiency ?? 0,
        deepMinutes: stages?.deep ?? null,
        remMinutes: stages?.rem ?? null,
        lightMinutes: stages?.light ?? null,
        wakeMinutes: stages?.wake ?? null,
        sleepStart: sleepMain?.startTime ? new Date(sleepMain.startTime) : null,
        sleepEnd: sleepMain?.endTime ? new Date(sleepMain.endTime) : null,
      },
      update: {
        minutesAsleep: sleepSummary?.totalMinutesAsleep ?? sleepMain?.minutesAsleep ?? 0,
        timeInBed: sleepSummary?.totalTimeInBed ?? sleepMain?.timeInBed ?? 0,
        efficiency: sleepMain?.efficiency ?? 0,
        deepMinutes: stages?.deep ?? null,
        remMinutes: stages?.rem ?? null,
        lightMinutes: stages?.light ?? null,
        wakeMinutes: stages?.wake ?? null,
        sleepStart: sleepMain?.startTime ? new Date(sleepMain.startTime) : null,
        sleepEnd: sleepMain?.endTime ? new Date(sleepMain.endTime) : null,
      },
    }),
    prisma.dailyHeartZones.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        zone2Minutes: zone2,
        cardioMinutes: cardio,
        peakMinutes: peak,
        outOfRangeMinutes: outOfRange,
        restingHeartRate: heartValue?.restingHeartRate ?? null,
      },
      update: {
        zone2Minutes: zone2,
        cardioMinutes: cardio,
        peakMinutes: peak,
        outOfRangeMinutes: outOfRange,
        restingHeartRate: heartValue?.restingHeartRate ?? null,
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
          cardioFitnessScore: cardioValue?.cardioFitnessScore ?? null,
          vo2Max: cardioValue?.vo2Max ?? null,
          hrvRmssd: hrvValue?.dailyRmssd ?? null,
          hrvDeepRmssd: hrvValue?.deepRmssd ?? null,
          breathingRate: brValue?.breathingRate ?? null,
          spo2Avg: spo2Value?.avg ?? null,
          spo2Min: spo2Value?.min ?? null,
          spo2Max: spo2Value?.max ?? null,
          skinTempC: skinTempValue?.nightlyRelative ?? null,
          coreTempC: coreTempValue?.value ?? null,
        },
        update: {
          cardioFitnessScore: cardioValue?.cardioFitnessScore ?? null,
          vo2Max: cardioValue?.vo2Max ?? null,
          hrvRmssd: hrvValue?.dailyRmssd ?? null,
          hrvDeepRmssd: hrvValue?.deepRmssd ?? null,
          breathingRate: brValue?.breathingRate ?? null,
          spo2Avg: spo2Value?.avg ?? null,
          spo2Min: spo2Value?.min ?? null,
          spo2Max: spo2Value?.max ?? null,
          skinTempC: skinTempValue?.nightlyRelative ?? null,
          coreTempC: coreTempValue?.value ?? null,
        },
      }),
    );
  }

  await Promise.all(writes);

  await syncActivitiesForDate(userId, dateKey);
}

async function syncActivitiesForDate(userId: string, dateKey: string) {
  const payload = await fetchJson<FitbitActivitiesListResponse>(
    userId,
    `/1/user/-/activities/list.json?beforeDate=${dateKey}&sort=asc&offset=0&limit=100`,
  ).catch(() => ({ activities: [] }));

  const dayStart = parseISO(`${dateKey}T00:00:00.000Z`);
  const dayEnd = addDays(dayStart, 1);

  const activities = (payload.activities ?? [])
    .filter((activity) => Boolean(activity.startTime))
    .map((activity) => {
      const startTime = new Date(activity.startTime as string);
      return { startTime, activity };
    })
    .filter(({ startTime }) => startTime >= dayStart && startTime < dayEnd);

  await prisma.activityLog.deleteMany({
    where: {
      userId,
      startTime: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  });

  if (activities.length === 0) return;

  await prisma.activityLog.createMany({
    data: activities.map(({ startTime, activity }) => ({
      userId,
      startTime,
      activityName: activity.activityName ?? "Activity",
      durationMinutes: Math.max(1, Math.round((activity.duration ?? 0) / 60000)),
      calories: activity.calories ?? null,
      distance: activity.distance ?? null,
      steps: activity.steps ?? null,
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

  return {
    syncedDays,
    warnings,
    rateLimited,
  };
}
