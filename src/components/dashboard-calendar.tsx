"use client";

import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";

import type { CalendarPayload, DayDashboard } from "@/lib/dashboard";

type DashboardCalendarProps = {
  payload: CalendarPayload;
  isDemo: boolean;
};

function zoneIntensity(zone2Minutes: number) {
  if (zone2Minutes === 0) return "from-slate-50 to-slate-100";
  if (zone2Minutes <= 20) return "from-teal-50 to-cyan-50";
  if (zone2Minutes <= 40) return "from-teal-100 to-cyan-100";
  if (zone2Minutes <= 60) return "from-teal-200 to-cyan-200";
  return "from-teal-300 to-cyan-300";
}

function sleepHours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

function compactNumber(value: number) {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function DashboardCalendar({ payload, isDemo }: DashboardCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(payload.days[0]?.date ?? "");
  const monthDays = useMemo(
    () => payload.days.filter((day) => day.date.startsWith(payload.month)),
    [payload.days, payload.month],
  );
  const monthlySummary = useMemo(() => {
    const tracked = monthDays.length || 1;
    const totalZone2 = monthDays.reduce((acc, day) => acc + day.zone2Minutes, 0);
    const avgSleep = monthDays.reduce((acc, day) => acc + day.sleepMinutes, 0) / tracked / 60;
    const avgSteps = Math.round(monthDays.reduce((acc, day) => acc + day.steps, 0) / tracked);
    const avgActiveMinutes = Math.round(monthDays.reduce((acc, day) => acc + day.activeMinutes, 0) / tracked);
    const avgSedentaryHours = monthDays.reduce((acc, day) => acc + day.sedentaryMinutes, 0) / tracked / 60;
    return { totalZone2, avgSleep, avgSteps, avgActiveMinutes, avgSedentaryHours };
  }, [monthDays]);

  const selectedDay = useMemo(
    () => payload.days.find((day) => day.date === selectedDate) ?? payload.days[0],
    [payload.days, selectedDate],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="soft-card interactive-card fade-up d-4 rounded-3xl p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">{payload.month} Calendar</h2>
            {isDemo ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Demo mode</span>
            ) : null}
          </div>

          <div className="mb-3 grid grid-cols-7 gap-2 text-xs font-medium text-slate-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="px-2 py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {payload.days.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={`min-h-24 rounded-2xl border border-slate-200/80 bg-gradient-to-br p-2 text-left transition hover:-translate-y-0.5 hover:border-teal-300 ${zoneIntensity(
                  day.zone2Minutes,
                )} ${selectedDate === day.date ? "ring-2 ring-teal-500 ring-offset-1" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{format(parseISO(day.date), "d")}</span>
                  {day.hasActivity ? <span className="h-2 w-2 animate-pulse rounded-full bg-teal-700" /> : null}
                </div>
                <div className="text-[11px] leading-4 text-slate-700">S {compactNumber(day.steps)}</div>
                <div className="text-[11px] leading-4 text-slate-700">Active {day.activeMinutes}m</div>
                <div className="text-[11px] leading-4 text-slate-700">Sleep {sleepHours(day.sleepMinutes)}</div>
                <div className="text-[11px] leading-4 text-slate-700">Score* {day.sleepScore ?? "-"}</div>
                <div className="text-[11px] font-semibold leading-4 text-teal-800">Z2 {day.zone2Minutes}m</div>
              </button>
            ))}
          </div>
        </div>

        <div className="soft-card interactive-card fade-up d-4 rounded-3xl p-5">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Weekly Summary (last 7 days)</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryTile label="Zone 2 Total" value={`${payload.weeklySummary.totalZone2Minutes}m`} />
            <SummaryTile label="Avg Sleep" value={`${payload.weeklySummary.averageSleepHours.toFixed(1)}h`} />
            <SummaryTile label="Avg Steps" value={compactNumber(payload.weeklySummary.averageSteps)} />
            <SummaryTile label="Avg Active" value={`${payload.weeklySummary.averageActiveMinutes}m`} />
            <SummaryTile label="Zone2 Days" value={`${payload.weeklySummary.zone2DaysCount}`} />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Avg sedentary time: {payload.weeklySummary.averageSedentaryHours.toFixed(1)}h/day
          </p>
        </div>

        <div className="soft-card interactive-card fade-up d-4 rounded-3xl p-5">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Monthly Summary ({payload.month})</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <SummaryTile label="Zone 2 Total" value={`${monthlySummary.totalZone2}m`} />
            <SummaryTile label="Avg Sleep" value={`${monthlySummary.avgSleep.toFixed(1)}h`} />
            <SummaryTile label="Avg Steps" value={compactNumber(monthlySummary.avgSteps)} />
            <SummaryTile label="Avg Active" value={`${monthlySummary.avgActiveMinutes}m`} />
            <SummaryTile label="Avg Sedentary" value={`${monthlySummary.avgSedentaryHours.toFixed(1)}h`} />
          </div>
        </div>
      </div>

      <DayDrawer day={selectedDay} />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-subcard rounded-2xl p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DayDrawer({ day }: { day?: DayDashboard }) {
  if (!day) return <aside className="soft-card rounded-3xl p-4">No day selected.</aside>;

  return (
    <aside className="soft-card interactive-card fade-up d-4 h-fit rounded-3xl p-5 lg:sticky lg:top-4">
      <h3 className="text-xl font-semibold text-slate-900">{format(parseISO(day.date), "EEEE, MMM d")}</h3>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Steps" value={day.steps.toLocaleString()} />
        <Stat label="Active" value={`${day.activeMinutes}m`} />
        <Stat label="Sleep" value={`${(day.sleepMinutes / 60).toFixed(1)}h`} />
        <Stat label="Sleep Score*" value={day.sleepScore !== null ? `${day.sleepScore}/100` : "-"} />
        <Stat label="Zone 2" value={`${day.zone2Minutes}m`} />
        <Stat label="Resting HR" value={day.restingHeartRate ? `${day.restingHeartRate} bpm` : "-"} />
        <Stat label="Sedentary" value={`${(day.sedentaryMinutes / 60).toFixed(1)}h`} />
      </div>

      <div className="soft-subcard mt-4 rounded-2xl p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sleep Breakdown</p>
        <p className="mt-1 text-sm text-slate-700">Deep: {day.sleep?.deepMinutes ?? 0}m</p>
        <p className="text-sm text-slate-700">REM: {day.sleep?.remMinutes ?? 0}m</p>
        <p className="text-sm text-slate-700">Light: {day.sleep?.lightMinutes ?? 0}m</p>
        <p className="text-sm text-slate-700">Wake: {day.sleep?.wakeMinutes ?? 0}m</p>
        <div className="mt-2 border-t border-slate-200/70 pt-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">
            Sleep Score: {day.sleepScoreBreakdown ? `${day.sleepScoreBreakdown.total}/100` : "-"}
          </p>
          <p>Duration: {day.sleepScoreBreakdown?.duration ?? "-"} / 50</p>
          <p>Depth (Deep+REM): {day.sleepScoreBreakdown?.depth ?? "-"} / 25</p>
          <p>Restoration: {day.sleepScoreBreakdown?.restoration ?? "-"} / 25</p>
        </div>
        <p className="mt-2 text-xs text-slate-500">*Derived from Fitbit sleep duration/stage/restoration signals (not a direct Fitbit API score).</p>
      </div>

      <div className="soft-subcard mt-4 rounded-2xl p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Heart Zones</p>
        <p className="mt-1 text-sm text-slate-700">Fat Burn (Zone 2): {day.zone2Minutes}m</p>
        <p className="text-sm text-slate-700">Cardio: {day.cardioMinutes}m</p>
        <p className="text-sm text-slate-700">Peak: {day.peakMinutes}m</p>
        <p className="text-sm text-slate-700">Out of Range: {day.outOfRangeMinutes}m</p>
      </div>

      <div className="soft-subcard mt-4 rounded-2xl p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activities</p>
        {day.activities.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">No activities logged.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {day.activities.map((activity) => (
              <li key={activity.id} className="rounded-xl border border-slate-200 bg-white p-2 text-sm">
                <p className="font-semibold text-slate-800">{activity.name}</p>
                <p className="text-slate-600">
                  {format(new Date(activity.startTime), "p")} • {activity.durationMinutes}m
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-subcard rounded-xl p-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
