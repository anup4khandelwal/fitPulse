import type { SleepInsightsPayload } from "@/lib/sleep-insights";

type SleepInsightsProps = {
  payload: SleepInsightsPayload;
  mode: "fitbit" | "recovery";
};

function deltaTone(value: number, positiveIsGood = true) {
  if (value === 0) return "text-slate-600";
  const improved = positiveIsGood ? value > 0 : value < 0;
  return improved ? "text-emerald-700" : "text-rose-700";
}

function signed(value: number, unit: string) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${unit}`;
}

export function SleepInsights({ payload, mode }: SleepInsightsProps) {
  return (
    <div className="soft-card interactive-card fade-up d-2 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Sleep Insights</h2>
      <p className="mt-1 text-sm text-slate-600">Debt, consistency, stage trends, and smart sleep flags.</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Source: Fitbit sleep API + derived scoring</p>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Sleep Score*</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
              {mode === "fitbit" ? "Fitbit" : "Recovery"}
            </span>
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {payload.sleepScore.latest !== null ? payload.sleepScore.latest : "n/a"}
            {payload.sleepScore.latest !== null ? "/100" : ""}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            7d avg: {payload.sleepScore.average7d !== null ? `${payload.sleepScore.average7d}/100` : "n/a"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">*Derived model, not direct Fitbit score API.</p>
        </div>

        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Sleep Debt (14d)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{payload.sleepDebtHours.toFixed(1)}h</p>
          <p className="mt-1 text-xs text-slate-600">Target: {payload.targetSleepHours.toFixed(1)}h/night</p>
        </div>
        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Poor Nights (14d)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{payload.poorNightsLast14}</p>
          <p className="mt-1 text-xs text-slate-600">Below sleep target</p>
        </div>
        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Consistency Score</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{payload.consistency.score}</p>
          <p className="mt-1 text-xs text-slate-600">Bed {payload.consistency.avgBedtime} • Wake {payload.consistency.avgWakeTime}</p>
        </div>
        <div className="soft-subcard interactive-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Timing Variability</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Bed ±{payload.consistency.bedtimeStdMinutes}m</p>
          <p className="text-sm font-semibold text-slate-900">Wake ±{payload.consistency.wakeStdMinutes}m</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sleep Stage Trend vs Prior Week</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <p className={deltaTone(payload.stageTrend.deepDelta, true)}>Deep: {signed(payload.stageTrend.deepDelta, "m")}</p>
            <p className={deltaTone(payload.stageTrend.remDelta, true)}>REM: {signed(payload.stageTrend.remDelta, "m")}</p>
            <p className={deltaTone(payload.stageTrend.lightDelta, true)}>Light: {signed(payload.stageTrend.lightDelta, "m")}</p>
            <p className={deltaTone(payload.stageTrend.wakeDelta, false)}>Wake: {signed(payload.stageTrend.wakeDelta, "m")}</p>
          </div>
        </div>

        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Smart Sleep Flags</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {payload.smartFlags.map((flag) => (
              <li key={flag}>• {flag}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
