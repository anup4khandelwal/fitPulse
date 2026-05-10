#!/usr/bin/env node
import { Command } from "commander";

import { defaultRange, parseRange } from "../mcp-server/db.js";
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
} from "../mcp-server/queries.js";
import { output } from "./format.js";

const program = new Command();

program
  .name("fitpulse")
  .description("Query your Google Health data from the terminal")
  .version("1.0.0");

// ── Shared options ─────────────────────────────────────────────────────────

function rangeOptions(cmd: Command) {
  return cmd
    .option("-f, --from <date>", "start date YYYY-MM-DD")
    .option("-t, --to <date>", "end date YYYY-MM-DD")
    .option("--format <fmt>", "output format: table|json|csv|md", "table");
}

async function getUser() {
  const user = await getSingleUser();
  if (!user) {
    console.error("No user found. Run the app and connect Google Health first.");
    process.exit(1);
  }
  return user;
}

// ── summary ────────────────────────────────────────────────────────────────

rangeOptions(
  program
    .command("summary")
    .description("Daily steps, active minutes, sedentary minutes, calories")
).action(async (opts) => {
  const user = await getUser();
  const range = parseRange(opts.from, opts.to);
  const rows = await querySummary(user.id, range.from, range.to);
  output(rows.map((r) => ({
    date: fmt(r.date),
    steps: r.steps,
    active_min: r.activeMinutes,
    sedentary_min: r.sedentaryMinutes,
    calories: r.caloriesOut ?? "—",
    zone2_proxy: r.lightlyActiveMins,
    cardio_min: r.fairlyActiveMins,
    peak_min: r.veryActiveMins,
  })), opts.format);
});

// ── sleep ──────────────────────────────────────────────────────────────────

rangeOptions(
  program
    .command("sleep")
    .description("Sleep duration, efficiency, and stage breakdown")
).action(async (opts) => {
  const user = await getUser();
  const range = parseRange(opts.from, opts.to);
  const rows = await querySleep(user.id, range.from, range.to);
  output(rows.map((r) => ({
    date: fmt(r.date),
    hours_asleep: +(r.minutesAsleep / 60).toFixed(2),
    time_in_bed_h: +(r.timeInBed / 60).toFixed(2),
    efficiency: r.efficiency,
    deep_min: r.deepMinutes ?? "—",
    rem_min: r.remMinutes ?? "—",
    light_min: r.lightMinutes ?? "—",
    wake_min: r.wakeMinutes ?? "—",
  })), opts.format);
});

// ── zones ──────────────────────────────────────────────────────────────────

rangeOptions(
  program
    .command("zones")
    .description("Heart rate zone minutes and resting heart rate")
).action(async (opts) => {
  const user = await getUser();
  const range = parseRange(opts.from, opts.to);
  const rows = await queryHeartZones(user.id, range.from, range.to);
  output(rows.map((r) => ({
    date: fmt(r.date),
    zone2_min: r.zone2Minutes,
    cardio_min: r.cardioMinutes ?? "—",
    peak_min: r.peakMinutes ?? "—",
    out_of_range_min: r.outOfRangeMinutes ?? "—",
    resting_hr: r.restingHeartRate ?? "—",
  })), opts.format);
});

// ── recovery ───────────────────────────────────────────────────────────────

rangeOptions(
  program
    .command("recovery")
    .description("Recovery biomarkers: VO2, HRV, SpO2, breathing rate, skin temp")
).action(async (opts) => {
  const user = await getUser();
  const range = parseRange(opts.from, opts.to);
  const rows = await queryRecovery(user.id, range.from, range.to);
  output(rows.map((r) => ({
    date: fmt(r.date),
    vo2_max: r.vo2Max ?? "—",
    hrv_ms: r.hrvRmssd ?? "—",
    breathing_bpm: r.breathingRate ?? "—",
    spo2_avg: r.spo2Avg ?? "—",
    spo2_min: r.spo2Min ?? "—",
    spo2_max: r.spo2Max ?? "—",
    skin_temp_c: r.skinTempC ?? "—",
  })), opts.format);
});

// ── weight ─────────────────────────────────────────────────────────────────

program
  .command("weight")
  .description("Body composition: weight, body fat %, BMI")
  .option("-f, --from <date>", "start date YYYY-MM-DD", defaultRange(30).from)
  .option("-t, --to <date>", "end date YYYY-MM-DD", defaultRange(30).to)
  .option("--format <fmt>", "output format: table|json|csv|md", "table")
  .action(async (opts) => {
    const user = await getUser();
    const rows = await queryWeight(user.id, opts.from, opts.to);
    output(rows.map((r) => ({
      date: fmt(r.date),
      weight_kg: r.weightKg,
      body_fat_pct: r.bodyFatPct ?? "—",
      bmi: r.bmi ?? "—",
    })), opts.format);
  });

// ── activities ─────────────────────────────────────────────────────────────

rangeOptions(
  program
    .command("activities")
    .description("Exercise sessions with duration, calories, distance, and steps")
).action(async (opts) => {
  const user = await getUser();
  const range = parseRange(opts.from, opts.to);
  const rows = await queryActivities(user.id, range.from, range.to);
  output(rows.map((r) => ({
    date: fmt(r.startTime),
    time: r.startTime.toISOString().slice(11, 16),
    activity: r.activityName,
    duration_min: r.durationMinutes,
    calories: r.calories ?? "—",
    distance_km: r.distance ?? "—",
    steps: r.steps ?? "—",
  })), opts.format);
});

// ── status ─────────────────────────────────────────────────────────────────

program
  .command("status")
  .description("Show last sync run status")
  .option("--format <fmt>", "output format: table|json", "table")
  .action(async (opts) => {
    const user = await getUser();
    const sync = await getLastSync(user.id);
    if (!sync) {
      console.log("No sync runs found. Connect Google Health and trigger a sync from the Settings page.");
      return;
    }
    const row = {
      status: sync.status,
      trigger: sync.trigger,
      from: fmt(sync.fromDate),
      to: fmt(sync.toDate),
      synced_days: sync.syncedDays,
      attempts: sync.attempts,
      started_at: sync.startedAt.toISOString(),
      ended_at: sync.endedAt?.toISOString() ?? "—",
      warnings: sync.warnings ? sync.warnings.split("\n").filter(Boolean).join("; ") : "none",
      error: sync.lastError ?? "none",
    };
    if (opts.format === "json") {
      console.log(JSON.stringify(row, null, 2));
    } else {
      output([row], "table");
    }
  });

// ── sync ───────────────────────────────────────────────────────────────────

program
  .command("sync")
  .description("Trigger a data sync via the fitPulse API (app must be running)")
  .requiredOption("-f, --from <date>", "start date YYYY-MM-DD")
  .requiredOption("-t, --to <date>", "end date YYYY-MM-DD")
  .option("--url <url>", "app base URL", "http://localhost:3000")
  .action(async (opts) => {
    const secret = process.env.SYNC_CRON_SECRET;
    if (!secret) {
      console.error("SYNC_CRON_SECRET not set in environment.");
      process.exit(1);
    }
    console.log(`Syncing ${opts.from} → ${opts.to} ...`);
    const res = await fetch(`${opts.url}/api/sync?from=${opts.from}&to=${opts.to}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    console.log(JSON.stringify({ status: res.status, ...body }, null, 2));
  });

program.parseAsync(process.argv);
