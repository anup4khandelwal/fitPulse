import type { ConditioningInsightsPayload } from "@/lib/conditioning-insights";

type Props = {
  payload: ConditioningInsightsPayload;
};

function splitTone(hardPct: number) {
  if (hardPct > 25) return "text-rose-700";
  if (hardPct < 15) return "text-amber-700";
  return "text-emerald-700";
}

function zone2Tone(status: ConditioningInsightsPayload["weekly"]["zone2Status"]) {
  if (status === "target") return "text-emerald-700";
  if (status === "low") return "text-amber-700";
  return "text-rose-700";
}

function zone2Label(status: ConditioningInsightsPayload["weekly"]["zone2Status"]) {
  if (status === "target") return "on target";
  if (status === "low") return "below target";
  return "above target";
}

export function ConditioningInsights({ payload }: Props) {
  return (
    <div className="soft-card interactive-card fade-up d-3 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Conditioning Insights</h2>
      <p className="mt-1 text-sm text-slate-600">Active load, sedentary balance, 80/20 intensity split, and adherence.</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Source: Fitbit API + derived coaching</p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Weekly Active Minutes</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{payload.weekly.activeMinutes}m</p>
          <p className="text-xs text-slate-600">Avg {payload.weekly.avgDailyActiveMinutes}m/day</p>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Estimated Sedentary</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{payload.weekly.sedentaryHours}h</p>
          <p className="text-xs text-slate-600">Per day (Fitbit sedentary minutes)</p>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Zone 2 Minutes</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{payload.weekly.zone2Minutes}m</p>
          <p className={`text-sm font-semibold capitalize ${zone2Tone(payload.weekly.zone2Status)}`}>{zone2Label(payload.weekly.zone2Status)}</p>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">High-Intensity Days</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{payload.weekly.highIntensityDays}</p>
          <p className="text-xs text-slate-600">Cardio+Peak sessions in last 7 days</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Polarized Intensity</p>
          <p className={`mt-1 text-lg font-semibold ${splitTone(payload.weekly.hardPct)}`}>
            Easy/Hard {payload.weekly.easyPct}% / {payload.weekly.hardPct}%
          </p>
          <p className="text-sm text-slate-700">Easy minutes: {payload.weekly.easyMinutes}m • Hard minutes: {payload.weekly.hardMinutes}m</p>
          <p className="mt-2 text-xs text-slate-600">Target distribution for most weeks: roughly 80% easy and 20% hard.</p>
        </div>

        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workout Adherence</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{payload.adherence.adherencePct}%</p>
          <p className="text-sm text-slate-700">
            {payload.adherence.workoutDays}/{payload.adherence.targetWorkoutDays} planned days completed this week
          </p>
          <p className="mt-2 text-xs text-slate-600">Remaining planned days: {payload.adherence.remainingWorkoutDays}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coach Notes</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {payload.coachNotes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>

        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next 3-Day Plan</p>
          <p className="mt-1 text-xs text-slate-600">
            Fill {payload.polarizedPlan.suggestedEasyMinutes} easy minutes, cap hard work near {payload.polarizedPlan.suggestedHardMinutesCap}m.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {payload.polarizedPlan.sessions.map((session) => (
              <span
                key={`${session.day}-${session.type}`}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                {session.day} {session.type} {session.minutes}m
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
