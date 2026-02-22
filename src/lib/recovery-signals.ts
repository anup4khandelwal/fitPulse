import { startOfDay, subDays } from "date-fns";

import type { DayDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";

type RecoveryMetric = {
  value: number | null;
  delta7d: number | null;
  unit: string;
  source: string;
};

export type RecoverySignalsPayload = {
  hasAnyData: boolean;
  dateLabel: string;
  cardioFitness: RecoveryMetric;
  vo2Max: RecoveryMetric;
  hrvRmssd: RecoveryMetric;
  breathingRate: RecoveryMetric;
  spo2Avg: RecoveryMetric;
  skinTempC: RecoveryMetric;
  coreTempC: RecoveryMetric;
  notes: string[];
};

type RecoveryRow = {
  date: Date;
  cardioFitnessScore: number | null;
  vo2Max: number | null;
  hrvRmssd: number | null;
  breathingRate: number | null;
  spo2Avg: number | null;
  skinTempC: number | null;
  coreTempC: number | null;
};

function round1(value: number | null) {
  return value === null ? null : Number(value.toFixed(1));
}

function findLatest(rows: RecoveryRow[], pick: (row: RecoveryRow) => number | null) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = pick(rows[i]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function averageLast(rows: RecoveryRow[], days: number, pick: (row: RecoveryRow) => number | null) {
  const subset = rows
    .slice(-days)
    .map(pick)
    .filter((value): value is number => value !== null);
  if (subset.length === 0) return null;
  return subset.reduce((acc, value) => acc + value, 0) / subset.length;
}

function metric(rows: RecoveryRow[], pick: (row: RecoveryRow) => number | null, unit: string, source: string): RecoveryMetric {
  const latest = findLatest(rows, pick);
  const avg7 = averageLast(rows, 7, pick);
  const prev7 = rows.length > 7 ? averageLast(rows.slice(0, -7), 7, pick) : null;
  const delta7d = latest !== null && prev7 !== null ? latest - prev7 : avg7 !== null && prev7 !== null ? avg7 - prev7 : null;

  return {
    value: round1(latest),
    delta7d: round1(delta7d),
    unit,
    source,
  };
}

function buildPayload(rows: RecoveryRow[], dateLabel: string): RecoverySignalsPayload {
  const cardioFitness = metric(rows, (row) => row.cardioFitnessScore, "score", "Fitbit Cardio Score API");
  const vo2Max = metric(rows, (row) => row.vo2Max, "ml/kg/min", "Fitbit Cardio Score API");
  const hrvRmssd = metric(rows, (row) => row.hrvRmssd, "ms", "Fitbit HRV API");
  const breathingRate = metric(rows, (row) => row.breathingRate, "br/min", "Fitbit Breathing Rate API");
  const spo2Avg = metric(rows, (row) => row.spo2Avg, "%", "Fitbit SpO2 API");
  const skinTempC = metric(rows, (row) => row.skinTempC, "C", "Fitbit Skin Temperature API");
  const coreTempC = metric(rows, (row) => row.coreTempC, "C", "Fitbit Core Temperature API");

  const hasAnyData =
    cardioFitness.value !== null ||
    vo2Max.value !== null ||
    hrvRmssd.value !== null ||
    breathingRate.value !== null ||
    spo2Avg.value !== null ||
    skinTempC.value !== null ||
    coreTempC.value !== null;

  const notes: string[] = [];
  if (!hasAnyData) {
    notes.push("No premium biomarker data returned yet. Reconnect Fitbit with expanded scopes, then sync recent days.");
  }
  if (vo2Max.value !== null && vo2Max.delta7d !== null && vo2Max.delta7d > 0.5) {
    notes.push(`VO2 max improved by ${vo2Max.delta7d.toFixed(1)} over prior week.`);
  }
  if (hrvRmssd.value !== null && hrvRmssd.delta7d !== null && hrvRmssd.delta7d < -5) {
    notes.push(`HRV dropped by ${Math.abs(hrvRmssd.delta7d).toFixed(1)}ms vs prior week. Consider lighter training.`);
  }
  if (spo2Avg.value !== null && spo2Avg.value < 94) {
    notes.push(`Average SpO2 is ${spo2Avg.value}%. Confirm sensor fit and monitor trend.`);
  }
  if (notes.length === 0) {
    notes.push("Recovery biomarkers are stable based on available Fitbit API data.");
  }

  return {
    hasAnyData,
    dateLabel,
    cardioFitness,
    vo2Max,
    hrvRmssd,
    breathingRate,
    spo2Avg,
    skinTempC,
    coreTempC,
    notes,
  };
}

export async function getRecoverySignals(userId: string): Promise<RecoverySignalsPayload> {
  const today = startOfDay(new Date());
  const from = subDays(today, 29);
  const recoveryModel = (prisma as unknown as { dailyRecovery?: { findMany: (args: unknown) => Promise<RecoveryRow[]> } })
    .dailyRecovery;

  if (!recoveryModel?.findMany) {
    const payload = buildPayload([], "n/a");
    return {
      ...payload,
      notes: [
        "Recovery model is unavailable in the running server process. Restart server after prisma generate.",
        ...payload.notes,
      ],
    };
  }

  const rows = await recoveryModel.findMany({
    where: { userId, date: { gte: from, lte: today } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      cardioFitnessScore: true,
      vo2Max: true,
      hrvRmssd: true,
      breathingRate: true,
      spo2Avg: true,
      skinTempC: true,
      coreTempC: true,
    },
  });

  const latestDate = rows.length > 0 ? rows[rows.length - 1].date.toISOString().slice(0, 10) : "n/a";
  return buildPayload(rows, latestDate);
}

export function buildDemoRecoverySignals(days: DayDashboard[]): RecoverySignalsPayload {
  const rows: RecoveryRow[] = days
    .filter((day) => day.date <= new Date().toISOString().slice(0, 10))
    .slice(-30)
    .map((day, idx) => ({
      date: new Date(`${day.date}T00:00:00.000Z`),
      cardioFitnessScore: 42 + (idx % 4),
      vo2Max: 39 + ((idx * 0.2) % 2),
      hrvRmssd: 45 + ((idx * 2) % 12),
      breathingRate: 14 + ((idx * 0.1) % 1),
      spo2Avg: 96 + ((idx * 0.1) % 1),
      skinTempC: -0.2 + ((idx * 0.03) % 0.4),
      coreTempC: 36.6 + ((idx * 0.02) % 0.3),
    }));

  return buildPayload(rows, rows.length > 0 ? rows[rows.length - 1].date.toISOString().slice(0, 10) : "n/a");
}
