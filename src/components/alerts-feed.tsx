import type { AlertItem } from "@/lib/alerts";

type AlertsFeedProps = {
  alerts: AlertItem[];
};

function severityClass(severity: string) {
  if (severity === "high") return "bg-rose-100 text-rose-800";
  if (severity === "medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

export function AlertsFeed({ alerts }: AlertsFeedProps) {
  return (
    <div className="soft-card interactive-card fade-up d-3 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Alerts</h2>
      <p className="mt-1 text-sm text-slate-600">Generated from recent syncs and weekly health thresholds.</p>

      {alerts.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No active alerts right now.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="soft-subcard interactive-subcard rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold capitalize text-slate-900">{alert.type.replaceAll("_", " ")}</p>
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${severityClass(alert.severity)}`}>
                  {alert.severity}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{alert.message}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(alert.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
