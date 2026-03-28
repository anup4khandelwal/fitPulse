import { format, parseISO } from "date-fns";

import type { LoadRecoveryChartPayload, LoadRecoveryChartPoint } from "@/lib/load-recovery-chart";

type Props = {
  payload: LoadRecoveryChartPayload;
};

type AxisLabel = {
  date: string;
  label: string;
  position: number;
};

const CHART_WIDTH = 560;
const PANEL_HEIGHT = 96;
const PANEL_GAP = 28;
const CHART_HEIGHT = PANEL_HEIGHT * 2 + PANEL_GAP;
const LOAD_BASELINE_Y = PANEL_HEIGHT;
const RECOVERY_TOP_Y = PANEL_HEIGHT + PANEL_GAP;
const RECOVERY_BASELINE_Y = RECOVERY_TOP_Y + PANEL_HEIGHT;

export function compactDate(date: string) {
  return format(parseISO(date), "MMM d");
}

export function roundLabel(value: number | null, suffix = "") {
  if (value === null) return "n/a";
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return `${rounded}${suffix}`;
}

export function axisLabels(dates: string[]): AxisLabel[] {
  if (dates.length === 0) return [];

  const lastIndex = dates.length - 1;
  const slots = Math.min(5, dates.length);
  const indexes = new Set<number>();

  for (let slot = 0; slot < slots; slot += 1) {
    indexes.add(Math.round((slot / Math.max(1, slots - 1)) * lastIndex));
  }

  return [...indexes]
    .sort((left, right) => left - right)
    .map((index) => ({
      date: dates[index] ?? "",
      label: compactDate(dates[index] ?? ""),
      position: lastIndex === 0 ? 50 : (index / lastIndex) * 100,
    }));
}

function badgeClass(state: "full" | "partial" | "empty") {
  if (state === "full") return "bg-emerald-100 text-emerald-800";
  if (state === "partial") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

function buildRecoveryPath(points: LoadRecoveryChartPoint[]) {
  if (points.length === 0) return "";

  const xStep = points.length === 1 ? 0 : CHART_WIDTH / (points.length - 1);
  let hasOpenSegment = false;
  let path = "";

  for (const [index, point] of points.entries()) {
    if (point.recovery === null) {
      hasOpenSegment = false;
      continue;
    }

    const x = points.length === 1 ? CHART_WIDTH / 2 : index * xStep;
    const y = RECOVERY_BASELINE_Y - (Math.max(0, Math.min(point.recovery, 100)) / 100) * PANEL_HEIGHT;
    const command = hasOpenSegment ? "L" : "M";

    path += `${command} ${x.toFixed(2)} ${y.toFixed(2)} `;
    hasOpenSegment = true;
  }

  return path.trim();
}

function loadBarGeometry(points: LoadRecoveryChartPoint[]) {
  const maxLoad = Math.max(...points.map((point) => point.load), 1);
  const slotWidth = points.length === 0 ? CHART_WIDTH : CHART_WIDTH / points.length;
  const barWidth = Math.max(8, slotWidth - 5);

  return points.map((point, index) => {
    const height = point.load === 0 ? 0 : Math.max(4, (point.load / maxLoad) * (PANEL_HEIGHT - 10));
    const x = index * slotWidth + (slotWidth - barWidth) / 2;
    const y = LOAD_BASELINE_Y - height;

    return {
      ...point,
      height,
      x,
      y,
      width: barWidth,
    };
  });
}

function recoveryDots(points: LoadRecoveryChartPoint[]) {
  if (points.length === 0) return [];

  const xStep = points.length === 1 ? 0 : CHART_WIDTH / (points.length - 1);

  return points.flatMap((point, index) => {
    if (point.recovery === null) return [];
    const x = points.length === 1 ? CHART_WIDTH / 2 : index * xStep;
    const y = RECOVERY_BASELINE_Y - (Math.max(0, Math.min(point.recovery, 100)) / 100) * PANEL_HEIGHT;
    return [{ date: point.date, x, y }];
  });
}

export function LoadRecoveryChart({ payload }: Props) {
  const description =
    "Daily weighted training load paired with recovery score from sleep, resting heart rate, and HRV when available.";

  if (payload.state === "empty") {
    return (
      <section className="soft-card interactive-card fade-up d-3 rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Training Load vs Recovery</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClass("empty")}`}>
            Empty
          </span>
        </div>

        <div className="soft-subcard mt-4 rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Availability</p>
          <p className="mt-2 text-sm text-slate-700">{payload.reason}</p>
        </div>
      </section>
    );
  }

  const labels = axisLabels(payload.points.map((point) => point.date));
  const bars = loadBarGeometry(payload.points);
  const recoveryPath = buildRecoveryPath(payload.points);
  const dots = recoveryDots(payload.points);
  const coverageText =
    payload.summary.recoveryCoverage === "full"
      ? "Full recovery coverage"
      : "Partial recovery coverage";
  const summaryCards = [
    { label: "7d Avg Load", value: roundLabel(payload.summary.avgLoad7d) },
    { label: "7d Avg Recovery", value: roundLabel(payload.summary.avgRecovery7d) },
    { label: "Highest Load Day", value: compactDate(payload.summary.highestLoadDate) },
    { label: "Highest Load Value", value: roundLabel(payload.summary.highestLoadValue) },
  ];

  return (
    <section className="soft-card interactive-card fade-up d-3 rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Training Load vs Recovery</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClass(
            payload.summary.recoveryCoverage,
          )}`}
        >
          {coverageText}
        </span>
      </div>

      <div className="soft-subcard mt-4 rounded-2xl p-4">
        <div className="grid gap-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Training Load</p>
              <p className="text-xs text-slate-500">Weighted daily minutes</p>
            </div>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="mt-3 h-64 w-full"
              role="img"
              aria-label="Training load bars and recovery score line for the last 28 days"
            >
              <defs>
                <linearGradient id="load-bar-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.75" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width={CHART_WIDTH} height={PANEL_HEIGHT} rx="18" fill="#f8fbff" />
              <rect
                x="0"
                y={RECOVERY_TOP_Y}
                width={CHART_WIDTH}
                height={PANEL_HEIGHT}
                rx="18"
                fill="#f8fbff"
              />
              <line x1="0" y1={LOAD_BASELINE_Y} x2={CHART_WIDTH} y2={LOAD_BASELINE_Y} stroke="#cbd5e1" />
              <line
                x1="0"
                y1={RECOVERY_BASELINE_Y}
                x2={CHART_WIDTH}
                y2={RECOVERY_BASELINE_Y}
                stroke="#cbd5e1"
              />
              <line
                x1="0"
                y1={RECOVERY_TOP_Y + PANEL_HEIGHT / 2}
                x2={CHART_WIDTH}
                y2={RECOVERY_TOP_Y + PANEL_HEIGHT / 2}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />

              {bars.map((bar) => (
                <rect
                  key={bar.date}
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  rx="7"
                  fill="url(#load-bar-fill)"
                />
              ))}

              {recoveryPath ? (
                <path
                  d={recoveryPath}
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {dots.map((dot) => (
                <circle key={dot.date} cx={dot.x} cy={dot.y} r="3.5" fill="#0f766e" />
              ))}
            </svg>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recovery Score</p>
              <p className="text-xs text-slate-500">Null days remain blank</p>
            </div>
            <div className="relative mt-3 h-5">
              {labels.map((label) => (
                <span
                  key={label.date}
                  className="absolute -translate-x-1/2 text-[11px] font-medium text-slate-500"
                  style={{ left: `${label.position}%` }}
                >
                  {label.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="soft-subcard interactive-subcard rounded-2xl p-3">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
