import type { StepInsightsPayload } from "@/lib/steps-insights";

type StepInsightsProps = {
  payload: StepInsightsPayload;
};

function paceTone(status: StepInsightsPayload["weeklyPacing"]["status"]) {
  if (status === "ahead") return "text-emerald-700";
  if (status === "behind") return "text-rose-700";
  return "text-slate-700";
}

function compact(n: number) {
  return n.toLocaleString();
}

export function StepInsights({ payload }: StepInsightsProps) {
  return (
    <div className="soft-card interactive-card fade-up d-2 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Step Insights</h2>
      <p className="mt-1 text-sm text-slate-600">Pacing, streaks, peak windows, and daily coaching target.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Today Steps</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{compact(payload.todaySteps)}</p>
          <p className="mt-1 text-xs text-slate-600">Target {compact(payload.dailyTarget)}</p>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Weekly Pace</p>
          <p className={`mt-1 text-lg font-semibold capitalize ${paceTone(payload.weeklyPacing.status)}`}>
            {payload.weeklyPacing.status.replace("_", " ")}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {compact(payload.weeklyPacing.currentTotal)} / {compact(payload.weeklyPacing.targetTotal)}
          </p>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Streaks</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Current: {payload.streaks.current} days</p>
          <p className="text-sm font-semibold text-slate-900">Best: {payload.streaks.best} days</p>
          <p className="mt-1 text-xs text-slate-600">Last break: {payload.streaks.lastBreak ?? "n/a"}</p>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Time-of-Day Split</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">AM {payload.distribution.morning}%</p>
          <p className="text-sm font-semibold text-slate-900">PM {payload.distribution.afternoon}%</p>
          <p className="text-sm font-semibold text-slate-900">Eve {payload.distribution.evening}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peak Step Windows</p>
          {payload.peakWindows.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No step-attributed activity windows yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {payload.peakWindows.map((window) => (
                <li key={window.label}>
                  <span className="font-semibold text-slate-900">{window.label}</span>
                  {` · ${compact(window.steps)} steps · ${window.pace.toFixed(1)} spm`}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Daily Coaching</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">Today target: {compact(payload.coaching.todayTarget)} steps</p>
          <p className="mt-1 text-sm text-slate-700">{payload.coaching.message}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Weekly Progression Plan</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {payload.progressionPlan.map((item) => (
              <span key={item.day} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {item.day} {compact(item.target)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
