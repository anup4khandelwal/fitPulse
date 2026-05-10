import { prisma } from "./db.js";

function toDate(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

export async function getSingleUser() {
  return prisma.user.findFirst();
}

export async function querySummary(userId: string, from: string, to: string) {
  return prisma.dailySummary.findMany({
    where: { userId, date: { gte: toDate(from), lte: toDate(to) } },
    orderBy: { date: "asc" },
    select: { date: true, steps: true, activeMinutes: true, sedentaryMinutes: true, caloriesOut: true, lightlyActiveMins: true, fairlyActiveMins: true, veryActiveMins: true },
  });
}

export async function querySleep(userId: string, from: string, to: string) {
  return prisma.dailySleep.findMany({
    where: { userId, date: { gte: toDate(from), lte: toDate(to) } },
    orderBy: { date: "asc" },
    select: { date: true, minutesAsleep: true, timeInBed: true, efficiency: true, deepMinutes: true, remMinutes: true, lightMinutes: true, wakeMinutes: true },
  });
}

export async function queryHeartZones(userId: string, from: string, to: string) {
  return prisma.dailyHeartZones.findMany({
    where: { userId, date: { gte: toDate(from), lte: toDate(to) } },
    orderBy: { date: "asc" },
    select: { date: true, zone2Minutes: true, cardioMinutes: true, peakMinutes: true, outOfRangeMinutes: true, restingHeartRate: true },
  });
}

export async function queryRecovery(userId: string, from: string, to: string) {
  return prisma.dailyRecovery.findMany({
    where: { userId, date: { gte: toDate(from), lte: toDate(to) } },
    orderBy: { date: "asc" },
    select: { date: true, vo2Max: true, hrvRmssd: true, breathingRate: true, spo2Avg: true, spo2Min: true, spo2Max: true, skinTempC: true },
  });
}

export async function queryWeight(userId: string, from: string, to: string) {
  return prisma.weightLog.findMany({
    where: { userId, date: { gte: toDate(from), lte: toDate(to) } },
    orderBy: { date: "asc" },
    select: { date: true, weightKg: true, bodyFatPct: true, bmi: true },
  });
}

export async function queryActivities(userId: string, from: string, to: string) {
  return prisma.activityLog.findMany({
    where: { userId, startTime: { gte: toDate(from), lte: new Date(`${to}T23:59:59.999Z`) } },
    orderBy: { startTime: "asc" },
    select: { startTime: true, activityName: true, durationMinutes: true, calories: true, distance: true, steps: true },
  });
}

export async function getLastSync(userId: string) {
  return prisma.syncRun.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: { trigger: true, status: true, fromDate: true, toDate: true, syncedDays: true, attempts: true, warnings: true, lastError: true, startedAt: true, endedAt: true },
  });
}

export function fmt(date: Date) {
  return date.toISOString().slice(0, 10);
}
