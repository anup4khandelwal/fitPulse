import type { TrendPayload, TrendWindow } from "@/lib/dashboard";

type TrendCardsProps = {
  payload: TrendPayload;
};

function compactNumber(value: number) {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatMetric(window: TrendWindow, metric: "zone2" | "sleep" | "steps" | "rhr") {
  if (metric === "zone2") {
    return {
      label: "Zone 2 Total",
      current: `${Math.round(window.zone2Total.current)}m`,
      delta: window.zone2Total.delta,
      deltaPct: window.zone2Total.deltaPct,
      betterWhenHigher: true,
    };
  }

  if (metric === "sleep") {
    return {
      label: "Avg Sleep",
      current: `${window.avgSleepHours.current.toFixed(1)}h`,
      delta: window.avgSleepHours.delta,
      deltaPct: window.avgSleepHours.deltaPct,
      betterWhenHigher: true,
    };
  }

  if (metric === "steps") {
    return {
      label: "Avg Steps",
      current: compactNumber(Math.round(window.avgSteps.current)),
      delta: window.avgSteps.delta,
      deltaPct: window.avgSteps.deltaPct,
      betterWhenHigher: true,
    };
  }

  return {
    label: "Avg Resting HR",
    current: `${window.avgRestingHeartRate.current.toFixed(1)} bpm`,
    delta: window.avgRestingHeartRate.delta,
    deltaPct: window.avgRestingHeartRate.deltaPct,
    betterWhenHigher: false,
  };
}

function deltaTone(delta: number, betterWhenHigher: boolean) {
  if (delta === 0) return "text-slate-500";
  const improved = betterWhenHigher ? delta > 0 : delta < 0;
  return improved ? "text-emerald-700" : "text-rose-700";
}

function deltaText(delta: number, deltaPct: number | null, metric: "zone2" | "sleep" | "steps" | "rhr") {
  const sign = delta > 0 ? "+" : "";
  const percent = deltaPct === null ? "n/a" : `${sign}${deltaPct.toFixed(1)}%`;

  if (metric === "zone2") return `${sign}${Math.round(delta)}m (${percent})`;
  if (metric === "sleep") return `${sign}${delta.toFixed(1)}h (${percent})`;
  if (metric === "steps") return `${sign}${Math.round(delta)} (${percent})`;
  return `${sign}${delta.toFixed(1)} bpm (${percent})`;
}

function sparkValues(payload: TrendPayload, metric: "zone2" | "sleep" | "steps" | "rhr") {
  const ordered = [...payload.windows].sort((a, b) => b.days - a.days);
  if (metric === "zone2") return ordered.map((window) => window.zone2Total.current);
  if (metric === "sleep") return ordered.map((window) => window.avgSleepHours.current);
  if (metric === "steps") return ordered.map((window) => window.avgSteps.current);
  return ordered.map((window) => window.avgRestingHeartRate.current);
}

function sparkColor(metric: "zone2" | "sleep" | "steps" | "rhr") {
  if (metric === "zone2") return "#0f766e";
  if (metric === "sleep") return "#0ea5e9";
  if (metric === "steps") return "#0891b2";
  return "#475569";
}

function Sparkline({ values, color, delayMs = 0 }: { values: number[]; color: string; delayMs?: number }) {
  const width = 180;
  const height = 54;
  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(1, values.length - 1);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const pointsStr = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full max-w-[190px] overflow-visible">
      <polyline
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        className="sparkline-line"
        style={{ animationDelay: `${delayMs}ms` }}
      />
      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={2.8}
          fill={color}
          className="sparkline-dot"
          style={{ animationDelay: `${delayMs + 120 + index * 80}ms` }}
        />
      ))}
    </svg>
  );
}

export function TrendCards({ payload }: TrendCardsProps) {
  const sparkMeta = [
    { key: "zone2" as const, label: "Zone 2", color: sparkColor("zone2") },
    { key: "sleep" as const, label: "Sleep", color: sparkColor("sleep") },
    { key: "steps" as const, label: "Steps", color: sparkColor("steps") },
    { key: "rhr" as const, label: "Resting HR", color: sparkColor("rhr") },
  ];

  return (
    <div className="soft-card interactive-card fade-up d-4 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Trend Analytics (7/30/90 days)</h2>
      <p className="mt-1 text-sm text-slate-600">Each window compares to the immediately previous window of equal length.</p>

      <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {sparkMeta.map((item, index) => (
          <div key={item.key} className="rounded-xl border border-slate-200/80 bg-white/90 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <Sparkline values={sparkValues(payload, item.key)} color={item.color} delayMs={index * 90} />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {payload.windows.map((window) => (
          <div key={window.days} className="soft-subcard interactive-subcard rounded-2xl p-3">
            <p className="text-sm font-semibold text-slate-900">Last {window.days} days</p>
            <div className="mt-3 space-y-3">
              {(["zone2", "sleep", "steps", "rhr"] as const).map((metricKey) => {
                const metric = formatMetric(window, metricKey);
                return (
                  <div key={metricKey} className="rounded-xl border border-slate-200/70 bg-white/90 p-2.5">
                    <p className="text-xs text-slate-500">{metric.label}</p>
                    <p className="text-base font-semibold text-slate-900">{metric.current}</p>
                    <p className={`text-xs ${deltaTone(metric.delta, metric.betterWhenHigher)}`}>
                      vs prior {window.days}d: {deltaText(metric.delta, metric.deltaPct, metricKey)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
