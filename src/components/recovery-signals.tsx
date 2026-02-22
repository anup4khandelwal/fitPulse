import type { RecoverySignalsPayload } from "@/lib/recovery-signals";

type Props = {
  payload: RecoverySignalsPayload;
};

type MetricKey =
  | "cardioFitness"
  | "vo2Max"
  | "hrvRmssd"
  | "breathingRate"
  | "spo2Avg"
  | "skinTempC"
  | "coreTempC";

function deltaText(delta: number | null) {
  if (delta === null) return "7d delta n/a";
  const sign = delta > 0 ? "+" : "";
  return `7d delta ${sign}${delta}`;
}

export function RecoverySignals({ payload }: Props) {
  const cards: Array<{ key: MetricKey; label: string }> = [
    { key: "cardioFitness", label: "Cardio Fitness" },
    { key: "vo2Max", label: "VO2 Max" },
    { key: "hrvRmssd", label: "HRV (RMSSD)" },
    { key: "breathingRate", label: "Breathing Rate" },
    { key: "spo2Avg", label: "SpO2" },
    { key: "skinTempC", label: "Skin Temp" },
    { key: "coreTempC", label: "Core Temp" },
  ];

  return (
    <div className="soft-card interactive-card fade-up d-3 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Recovery Signals</h2>
      <p className="mt-1 text-sm text-slate-600">Premium biomarker endpoints from Fitbit Web API only.</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Last synced biomarker date: {payload.dateLabel}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => {
          const metric = payload[card.key];
          return (
            <div key={card.key} className="soft-subcard interactive-subcard rounded-2xl p-3">
              <p className="text-xs text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {metric.value !== null ? `${metric.value} ${metric.unit}` : "n/a"}
              </p>
              <p className="mt-1 text-xs text-slate-600">{deltaText(metric.delta7d)}</p>
              <p className="mt-1 text-[11px] text-slate-500">{metric.source}</p>
            </div>
          );
        })}
      </div>

      <div className="soft-subcard mt-4 rounded-2xl p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coach Notes</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {payload.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
