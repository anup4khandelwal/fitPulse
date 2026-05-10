"use client";

import { WeightInsightsPayload } from "@/lib/weight-insights";

type Props = { payload: WeightInsightsPayload };

function Stat({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="stat-value text-2xl font-bold text-white">{value ?? "—"}</span>
      {sub && <span className="text-xs font-medium text-slate-400">{sub}</span>}
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}

function MiniChart({ points }: { points: WeightInsightsPayload["points"] }) {
  if (points.length < 2) return null;

  const weights = points.map((p) => p.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const W = 320;
  const H = 60;
  const pad = 4;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = H - pad - ((p.weightKg - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });

  const path = `M${coords.join(" L")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 60 }}>
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L${W - pad},${H} L${pad},${H} Z`}
        fill="url(#wg)"
      />
      <path d={path} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function WeightWidget({ payload }: Props) {
  const { latestWeightKg, latestBodyFatPct, latestBmi, changeKg, changePct, points } = payload;

  if (points.length === 0) return null;

  const changeColor =
    changeKg == null ? "text-slate-400" : changeKg < 0 ? "text-teal-400" : changeKg > 0 ? "text-rose-400" : "text-slate-400";
  const changeSign = changeKg != null && changeKg > 0 ? "+" : "";

  return (
    <section className="soft-card fade-up d-5 rounded-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">Body Composition</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Weight & Body Fat</h2>
        </div>
        {changeKg != null && (
          <span className={`text-sm font-semibold ${changeColor}`}>
            {changeSign}{changeKg} kg ({changeSign}{changePct}%) last 90d
          </span>
        )}
      </div>

      <div className="mb-4 flex justify-around gap-4 rounded-2xl border border-white/6 bg-white/3 py-4">
        <Stat
          label="Weight"
          value={latestWeightKg != null ? `${latestWeightKg.toFixed(1)} kg` : null}
        />
        {latestBodyFatPct != null && (
          <>
            <div className="w-px bg-white/10" />
            <Stat label="Body Fat" value={`${latestBodyFatPct.toFixed(1)}%`} />
          </>
        )}
        {latestBmi != null && (
          <>
            <div className="w-px bg-white/10" />
            <Stat
              label="BMI"
              value={latestBmi.toFixed(1)}
              sub={latestBmi < 18.5 ? "Underweight" : latestBmi < 25 ? "Normal" : latestBmi < 30 ? "Overweight" : "Obese"}
            />
          </>
        )}
      </div>

      <MiniChart points={points} />
      <p className="mt-1 text-right text-xs text-slate-600">Last {points.length} readings</p>
    </section>
  );
}
