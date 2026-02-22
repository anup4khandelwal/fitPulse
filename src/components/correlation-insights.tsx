import type { CorrelationInsight } from "@/lib/dashboard";

type CorrelationInsightsProps = {
  insights: CorrelationInsight[];
};

function badgeClass(confidence: CorrelationInsight["confidence"]) {
  if (confidence === "high") return "bg-emerald-100 text-emerald-800";
  if (confidence === "medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

export function CorrelationInsights({ insights }: CorrelationInsightsProps) {
  return (
    <div className="soft-card interactive-card fade-up d-4 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Correlation Insights</h2>
      <p className="mt-1 text-sm text-slate-600">Signal only. Correlation does not prove causation.</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {insights.map((insight) => (
          <div key={insight.id} className="soft-subcard interactive-subcard rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badgeClass(insight.confidence)}`}>
                {insight.confidence}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{insight.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
