import { subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export type CoachingData = {
  period: { from: string; to: string };
  sleep: {
    date: string;
    hoursAsleep: number;
    efficiency: number | null;
    deepMinutes: number | null;
    remMinutes: number | null;
    wakeMinutes: number | null;
  }[];
  steps: { date: string; steps: number | null; activeMinutes: number | null; caloriesOut: number | null }[];
  heartZones: {
    date: string;
    zone2Minutes: number | null;
    cardioMinutes: number | null;
    peakMinutes: number | null;
    restingHeartRate: number | null;
  }[];
  recovery: {
    date: string;
    vo2Max: number | null;
    hrvRmssd: number | null;
    breathingRate: number | null;
    spo2Avg: number | null;
  }[];
  activities: { date: string; activity: string; durationMinutes: number; calories: number | null }[];
};

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getCoachingData(userId: string, days = 14): Promise<CoachingData> {
  const to = startOfDay(new Date());
  const from = subDays(to, days - 1);
  const fromStr = fmt(from);
  const toStr = fmt(to);
  const toEnd = new Date(`${toStr}T23:59:59.999Z`);

  const [sleepRows, summaryRows, heartRows, recoveryRows, activityRows] = await Promise.all([
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { date: true, minutesAsleep: true, efficiency: true, deepMinutes: true, remMinutes: true, wakeMinutes: true },
    }),
    prisma.dailySummary.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { date: true, steps: true, activeMinutes: true, caloriesOut: true },
    }),
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { date: true, zone2Minutes: true, cardioMinutes: true, peakMinutes: true, restingHeartRate: true },
    }),
    prisma.dailyRecovery.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { date: true, vo2Max: true, hrvRmssd: true, breathingRate: true, spo2Avg: true },
    }),
    prisma.activityLog.findMany({
      where: { userId, startTime: { gte: from, lte: toEnd } },
      orderBy: { startTime: "asc" },
      select: { startTime: true, activityName: true, durationMinutes: true, calories: true },
    }),
  ]);

  return {
    period: { from: fromStr, to: toStr },
    sleep: sleepRows.map((r) => ({
      date: fmt(r.date),
      hoursAsleep: +(r.minutesAsleep / 60).toFixed(2),
      efficiency: r.efficiency,
      deepMinutes: r.deepMinutes,
      remMinutes: r.remMinutes,
      wakeMinutes: r.wakeMinutes,
    })),
    steps: summaryRows.map((r) => ({
      date: fmt(r.date),
      steps: r.steps,
      activeMinutes: r.activeMinutes,
      caloriesOut: r.caloriesOut,
    })),
    heartZones: heartRows.map((r) => ({
      date: fmt(r.date),
      zone2Minutes: r.zone2Minutes,
      cardioMinutes: r.cardioMinutes,
      peakMinutes: r.peakMinutes,
      restingHeartRate: r.restingHeartRate,
    })),
    recovery: recoveryRows.map((r) => ({
      date: fmt(r.date),
      vo2Max: r.vo2Max,
      hrvRmssd: r.hrvRmssd,
      breathingRate: r.breathingRate,
      spo2Avg: r.spo2Avg,
    })),
    activities: activityRows.map((r) => ({
      date: fmt(r.startTime),
      activity: r.activityName ?? "Unknown",
      durationMinutes: r.durationMinutes ?? 0,
      calories: r.calories,
    })),
  };
}

export function buildDemoCoachingData(): CoachingData {
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(today, 13 - i);
    return fmt(d);
  });

  return {
    period: { from: days[0], to: days[13] },
    sleep: days.map((date) => ({
      date,
      hoursAsleep: 6.5 + Math.random() * 1.5,
      efficiency: 80 + Math.floor(Math.random() * 15),
      deepMinutes: 60 + Math.floor(Math.random() * 30),
      remMinutes: 90 + Math.floor(Math.random() * 30),
      wakeMinutes: 10 + Math.floor(Math.random() * 20),
    })),
    steps: days.map((date) => ({
      date,
      steps: 6000 + Math.floor(Math.random() * 6000),
      activeMinutes: 20 + Math.floor(Math.random() * 40),
      caloriesOut: 1800 + Math.floor(Math.random() * 400),
    })),
    heartZones: days.map((date) => ({
      date,
      zone2Minutes: Math.floor(Math.random() * 45),
      cardioMinutes: Math.floor(Math.random() * 20),
      peakMinutes: Math.floor(Math.random() * 10),
      restingHeartRate: 52 + Math.floor(Math.random() * 12),
    })),
    recovery: days.map((date) => ({
      date,
      vo2Max: 44 + Math.random() * 4,
      hrvRmssd: 38 + Math.random() * 20,
      breathingRate: 14 + Math.random() * 3,
      spo2Avg: 96 + Math.random() * 3,
    })),
    activities: days
      .filter((_, i) => i % 3 === 0)
      .map((date) => ({
        date,
        activity: ["Running", "Cycling", "Walking", "Yoga"][Math.floor(Math.random() * 4)],
        durationMinutes: 30 + Math.floor(Math.random() * 45),
        calories: 200 + Math.floor(Math.random() * 300),
      })),
  };
}
