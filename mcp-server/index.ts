#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { defaultRange, parseRange } from "./db.js";
import {
  fmt,
  getLastSync,
  queryActivities,
  queryHeartZones,
  queryRecovery,
  querySleep,
  querySummary,
  queryWeight,
  getSingleUser,
} from "./queries.js";

const server = new McpServer({
  name: "fitpulse",
  version: "1.0.0",
});

const dateRangeSchema = {
  from: z.string().optional().describe("Start date YYYY-MM-DD (default: 7 days ago)"),
  to: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
};

async function withUser<T>(fn: (userId: string) => Promise<T>): Promise<T> {
  const user = await getSingleUser();
  if (!user) throw new Error("No user found. Run the app and connect Google Health first.");
  return fn(user.id);
}

// ── Tools ─────────────────────────────────────────────────────────────────────

server.registerTool(
  "get_daily_summary",
  {
    description: "Get daily steps, active minutes, sedentary minutes, and calories for a date range.",
    inputSchema: dateRangeSchema,
  },
  async ({ from, to }) => {
    const range = parseRange(from, to);
    const rows = await withUser((uid) => querySummary(uid, range.from, range.to));
    return {
      content: [{ type: "text", text: JSON.stringify(rows.map((r) => ({ date: fmt(r.date), steps: r.steps, activeMinutes: r.activeMinutes, sedentaryMinutes: r.sedentaryMinutes, caloriesOut: r.caloriesOut, zone2Proxy_fatBurnMins: r.lightlyActiveMins, cardioMins: r.fairlyActiveMins, peakMins: r.veryActiveMins })), null, 2) }],
    };
  },
);

server.registerTool(
  "get_sleep",
  {
    description: "Get sleep data including duration, efficiency, and stage breakdown (deep/REM/light/wake) for a date range.",
    inputSchema: dateRangeSchema,
  },
  async ({ from, to }) => {
    const range = parseRange(from, to);
    const rows = await withUser((uid) => querySleep(uid, range.from, range.to));
    return {
      content: [{
        type: "text", text: JSON.stringify(rows.map((r) => ({
          date: fmt(r.date),
          hoursAsleep: +(r.minutesAsleep / 60).toFixed(2),
          minutesAsleep: r.minutesAsleep,
          timeInBed: r.timeInBed,
          efficiency: r.efficiency,
          deepMinutes: r.deepMinutes,
          remMinutes: r.remMinutes,
          lightMinutes: r.lightMinutes,
          wakeMinutes: r.wakeMinutes,
        })), null, 2),
      }],
    };
  },
);

server.registerTool(
  "get_heart_rate_zones",
  {
    description: "Get daily heart rate zone minutes (Zone 2 / cardio / peak) and resting heart rate for a date range.",
    inputSchema: dateRangeSchema,
  },
  async ({ from, to }) => {
    const range = parseRange(from, to);
    const rows = await withUser((uid) => queryHeartZones(uid, range.from, range.to));
    return {
      content: [{ type: "text", text: JSON.stringify(rows.map((r) => ({ date: fmt(r.date), zone2Minutes: r.zone2Minutes, cardioMinutes: r.cardioMinutes, peakMinutes: r.peakMinutes, outOfRangeMinutes: r.outOfRangeMinutes, restingHeartRate: r.restingHeartRate })), null, 2) }],
    };
  },
);

server.registerTool(
  "get_recovery_signals",
  {
    description: "Get daily recovery biomarkers: VO2 max, HRV (RMSSD), respiratory rate, SpO2, and skin temperature.",
    inputSchema: dateRangeSchema,
  },
  async ({ from, to }) => {
    const range = parseRange(from, to);
    const rows = await withUser((uid) => queryRecovery(uid, range.from, range.to));
    return {
      content: [{ type: "text", text: JSON.stringify(rows.map((r) => ({ date: fmt(r.date), vo2Max: r.vo2Max, hrvRmssd_ms: r.hrvRmssd, breathingRate: r.breathingRate, spo2Avg: r.spo2Avg, spo2Min: r.spo2Min, spo2Max: r.spo2Max, skinTempC: r.skinTempC })), null, 2) }],
    };
  },
);

server.registerTool(
  "get_weight",
  {
    description: "Get body composition history: weight (kg), body fat percentage, and BMI.",
    inputSchema: {
      from: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      to: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
  },
  async ({ from, to }) => {
    const def = defaultRange(30);
    const range = parseRange(from ?? def.from, to ?? def.to);
    const rows = await withUser((uid) => queryWeight(uid, range.from, range.to));
    return {
      content: [{ type: "text", text: JSON.stringify(rows.map((r) => ({ date: fmt(r.date), weightKg: r.weightKg, bodyFatPct: r.bodyFatPct, bmi: r.bmi })), null, 2) }],
    };
  },
);

server.registerTool(
  "get_activities",
  {
    description: "List exercise sessions with activity type, duration, calories, distance, and steps.",
    inputSchema: dateRangeSchema,
  },
  async ({ from, to }) => {
    const range = parseRange(from, to);
    const rows = await withUser((uid) => queryActivities(uid, range.from, range.to));
    return {
      content: [{
        type: "text", text: JSON.stringify(rows.map((r) => ({
          date: fmt(r.startTime),
          time: r.startTime.toISOString().slice(11, 16),
          activity: r.activityName,
          durationMinutes: r.durationMinutes,
          calories: r.calories,
          distanceKm: r.distance,
          steps: r.steps,
        })), null, 2),
      }],
    };
  },
);

server.registerTool(
  "get_sync_status",
  {
    description: "Get the status of the most recent data sync run.",
    inputSchema: {},
  },
  async () => {
    const user = await getSingleUser();
    if (!user) {
      return { content: [{ type: "text", text: "No user found." }] };
    }
    const sync = await getLastSync(user.id);
    if (!sync) {
      return { content: [{ type: "text", text: "No sync runs found. Connect Google Health and trigger a sync." }] };
    }
    return {
      content: [{
        type: "text", text: JSON.stringify({
          status: sync.status,
          trigger: sync.trigger,
          from: fmt(sync.fromDate),
          to: fmt(sync.toDate),
          syncedDays: sync.syncedDays,
          attempts: sync.attempts,
          startedAt: sync.startedAt.toISOString(),
          endedAt: sync.endedAt?.toISOString() ?? null,
          warnings: sync.warnings ? sync.warnings.split("\n").filter(Boolean) : [],
          lastError: sync.lastError ?? null,
        }, null, 2),
      }],
    };
  },
);

server.registerTool(
  "sync_data",
  {
    description: "Trigger a data sync from Google Health API for a date range. Requires Google Health to be connected.",
    inputSchema: {
      from: z.string().describe("Start date YYYY-MM-DD"),
      to: z.string().describe("End date YYYY-MM-DD"),
    },
  },
  async ({ from, to }) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const secret = process.env.SYNC_CRON_SECRET;
    if (!secret) {
      return { content: [{ type: "text", text: "SYNC_CRON_SECRET not set. Cannot trigger sync via MCP." }] };
    }
    const res = await fetch(`${baseUrl}/api/sync?from=${from}&to=${to}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    return {
      content: [{ type: "text", text: JSON.stringify({ status: res.status, ...body }, null, 2) }],
    };
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
