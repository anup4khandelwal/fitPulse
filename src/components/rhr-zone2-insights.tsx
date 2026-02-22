import type { RhrZone2InsightsPayload } from "@/lib/rhr-zone2-insights";

type Props = {
  payload: RhrZone2InsightsPayload;
};

function statusColor(status: RhrZone2InsightsPayload["baseline"]["status"]) {
  if (status === "improving") return "text-emerald-700";
  if (status === "elevated") return "text-rose-700";
  return "text-slate-700";
}

function readinessColor(label: RhrZone2InsightsPayload["readiness"]["label"]) {
  if (label === "High") return "text-emerald-700";
  if (label === "Low") return "text-rose-700";
  return "text-amber-700";
}

export function RhrZone2Insights({ payload }: Props) {
  return (
    <div className="soft-card interactive-card fade-up d-3 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">RHR + Zone2 Insights</h2>
      <p className="mt-1 text-sm text-slate-600">Baseline deviation, readiness, and weekly Zone2 session planner.</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Source: Fitbit heart-rate zones API + derived readiness</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">RHR Baseline</p>
          <p className={`mt-1 text-lg font-semibold ${statusColor(payload.baseline.status)}`}>
            {payload.baseline.status}
          </p>
          <p className="text-sm text-slate-700">Today: {payload.baseline.todayRhr ?? "n/a"} bpm</p>
          <p className="text-sm text-slate-700">7d: {payload.baseline.rhr7d ?? "n/a"} · 30d: {payload.baseline.rhr30d ?? "n/a"}</p>
          <p className="text-sm text-slate-700">Delta vs 30d: {payload.baseline.deltaVs30d ?? "n/a"} bpm</p>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Recovery Readiness</p>
          <p className={`mt-1 text-2xl font-semibold ${readinessColor(payload.readiness.label)}`}>{payload.readiness.score}</p>
          <p className="text-sm font-semibold text-slate-700">{payload.readiness.label}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {payload.readiness.reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Zone2 Consistency Planner</p>
          <p className="mt-1 text-sm text-slate-700">
            {payload.planner.completedZone2Days}/{payload.planner.targetZone2Days} days done this week
          </p>
          <p className="text-sm text-slate-700">Remaining days this week: {payload.planner.remainingDays}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {payload.planner.suggestedSessions.length === 0 ? (
              <span className="text-xs text-slate-600">Target reached for this week.</span>
            ) : (
              payload.planner.suggestedSessions.map((session) => (
                <span key={`${session.day}-${session.minutes}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {session.day} {session.minutes}m
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
