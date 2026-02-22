import { format, startOfDay, subDays } from "date-fns";

import { prisma } from "@/lib/prisma";

export type AlertPreferencesPayload = {
  minSleepHours: number;
  minAvgSteps: number;
  minZone2Days: number;
  maxRestingHrDelta: number;
  alertsEnabled: boolean;
};

export type AlertItem = {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
};

const DEFAULT_PREFS: AlertPreferencesPayload = {
  minSleepHours: 6.5,
  minAvgSteps: 7000,
  minZone2Days: 3,
  maxRestingHrDelta: 4,
  alertsEnabled: true,
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function bedtimeMinutes(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
}

export async function getOrCreateAlertPreferences(userId: string): Promise<AlertPreferencesPayload> {
  const prefs = await prisma.alertPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_PREFS,
    },
  });

  return {
    minSleepHours: prefs.minSleepHours,
    minAvgSteps: prefs.minAvgSteps,
    minZone2Days: prefs.minZone2Days,
    maxRestingHrDelta: prefs.maxRestingHrDelta,
    alertsEnabled: prefs.alertsEnabled,
  };
}

export async function listRecentAlerts(userId: string, limit = 20): Promise<AlertItem[]> {
  const alerts = await prisma.alertEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 100)),
  });

  return alerts.map((alert) => ({
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    createdAt: alert.createdAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
  }));
}

export async function evaluateAndStoreAlerts(userId: string) {
  const prefs = await getOrCreateAlertPreferences(userId);
  if (!prefs.alertsEnabled) {
    return [];
  }

  const today = startOfDay(new Date());
  const weekStart = subDays(today, 6);
  const prevStart = subDays(today, 16);
  const prevEnd = subDays(today, 3);

  const [weeklySleep, weeklySteps, weeklyZones, currentHrRows, baselineHrRows, recentSleeps] = await Promise.all([
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: weekStart, lte: today } },
      select: { minutesAsleep: true },
    }),
    prisma.dailySummary.findMany({
      where: { userId, date: { gte: weekStart, lte: today } },
      select: { steps: true },
    }),
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: weekStart, lte: today } },
      select: { zone2Minutes: true, restingHeartRate: true },
    }),
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: subDays(today, 2), lte: today } },
      select: { restingHeartRate: true },
    }),
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: prevStart, lte: prevEnd } },
      select: { restingHeartRate: true },
    }),
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: subDays(today, 20), lte: today } },
      select: { date: true, minutesAsleep: true, sleepStart: true, remMinutes: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const avgSleepHours = average(weeklySleep.map((row) => row.minutesAsleep)) / 60;
  const avgSteps = average(weeklySteps.map((row) => row.steps));
  const zone2Days = weeklyZones.filter((row) => row.zone2Minutes > 0).length;

  const currentHr = average(
    currentHrRows.map((row) => row.restingHeartRate).filter((value): value is number => value !== null),
  );
  const baselineHr = average(
    baselineHrRows.map((row) => row.restingHeartRate).filter((value): value is number => value !== null),
  );

  const dayKey = format(today, "yyyy-MM-dd");
  const candidates: Array<{ type: string; severity: string; message: string }> = [];

  if (avgSleepHours > 0 && avgSleepHours < prefs.minSleepHours) {
    candidates.push({
      type: "low_sleep",
      severity: "medium",
      message: `Average sleep is ${avgSleepHours.toFixed(1)}h, below target ${prefs.minSleepHours.toFixed(1)}h.`,
    });
  }

  if (avgSteps > 0 && avgSteps < prefs.minAvgSteps) {
    candidates.push({
      type: "low_steps",
      severity: "medium",
      message: `Average steps are ${Math.round(avgSteps).toLocaleString()}, below target ${prefs.minAvgSteps.toLocaleString()}.`,
    });
  }

  if (zone2Days < prefs.minZone2Days) {
    candidates.push({
      type: "low_zone2_days",
      severity: "low",
      message: `Zone 2 activity logged on ${zone2Days} day(s); target is ${prefs.minZone2Days} day(s).`,
    });
  }

  if (baselineHr > 0 && currentHr - baselineHr >= prefs.maxRestingHrDelta) {
    candidates.push({
      type: "elevated_rhr",
      severity: "high",
      message: `Resting HR is up by ${(currentHr - baselineHr).toFixed(1)} bpm vs baseline. Prioritize recovery today.`,
    });
  }

  const combinedSleepRisk = avgSleepHours > 0 && avgSleepHours < prefs.minSleepHours;
  const combinedRhrRisk = baselineHr > 0 && currentHr - baselineHr >= prefs.maxRestingHrDelta;
  const combinedLoadRisk = weeklyZones.reduce((acc, row) => acc + row.zone2Minutes, 0) >= 180;
  if (combinedSleepRisk && combinedRhrRisk && combinedLoadRisk) {
    candidates.push({
      type: "combined_recovery_risk",
      severity: "high",
      message: "RHR elevated + low sleep + high Zone2 load. Consider a lighter recovery day.",
    });
  }

  const sleepThresholdMin = prefs.minSleepHours * 60;
  const last3Sleeps = [...recentSleeps].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 3);
  if (last3Sleeps.length === 3 && last3Sleeps.every((row) => row.minutesAsleep < sleepThresholdMin)) {
    candidates.push({
      type: "poor_sleep_streak",
      severity: "high",
      message: "Three consecutive low-sleep nights detected. Schedule a recovery night.",
    });
  }

  const currentBedRows = recentSleeps.filter((row) => row.date >= weekStart && row.date <= today);
  const prevBedRows = recentSleeps.filter((row) => row.date >= subDays(today, 13) && row.date <= subDays(today, 7));
  const currentBedAvg = average(
    currentBedRows.map((row) => row.sleepStart).filter((v): v is Date => v !== null).map((v) => bedtimeMinutes(v)),
  );
  const prevBedAvg = average(
    prevBedRows.map((row) => row.sleepStart).filter((v): v is Date => v !== null).map((v) => bedtimeMinutes(v)),
  );
  if (currentBedAvg > 0 && prevBedAvg > 0 && currentBedAvg - prevBedAvg > 45) {
    candidates.push({
      type: "bedtime_drift",
      severity: "medium",
      message: `Bedtime drifted later by ${Math.round(currentBedAvg - prevBedAvg)} minutes vs prior week.`,
    });
  }

  const currentRem = average(currentBedRows.map((row) => row.remMinutes ?? 0));
  const prevRem = average(prevBedRows.map((row) => row.remMinutes ?? 0));
  if (prevRem > 0 && currentRem < prevRem * 0.85) {
    candidates.push({
      type: "rem_drop",
      severity: "medium",
      message: `REM sleep dropped by ${Math.round(((prevRem - currentRem) / prevRem) * 100)}% vs prior week.`,
    });
  }

  if (candidates.length === 0) {
    return [];
  }

  const created = await Promise.all(
    candidates.map((candidate) =>
      prisma.alertEvent.upsert({
        where: { userId_dayKey_type: { userId, dayKey, type: candidate.type } },
        update: {
          severity: candidate.severity,
          message: candidate.message,
          resolvedAt: null,
        },
        create: {
          userId,
          dayKey,
          type: candidate.type,
          severity: candidate.severity,
          message: candidate.message,
        },
      }),
    ),
  );

  return created;
}
