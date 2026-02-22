import type { GoalsPayload } from "@/lib/goals";

type GoalsCoachingProps = {
  payload: GoalsPayload;
};

function formatCurrent(value: number, unit: string) {
  if (unit === "steps") {
    return Math.round(value).toLocaleString();
  }

  if (unit === "h") {
    return value.toFixed(1);
  }

  return Math.round(value).toString();
}

function formatTarget(value: number, unit: string) {
  if (unit === "steps") {
    return Math.round(value).toLocaleString();
  }

  if (unit === "h") {
    return value.toFixed(1);
  }

  return Math.round(value).toString();
}

export function GoalsCoaching({ payload }: GoalsCoachingProps) {
  return (
    <div className="soft-card interactive-card fade-up d-2 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Weekly Goals + Coaching</h2>
      <p className="mt-1 text-sm text-slate-600">Progress is based on the last 7 days. Update targets in Settings.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {payload.progress.map((item) => (
          <div key={item.label} className="soft-subcard interactive-subcard rounded-2xl p-3">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {formatCurrent(item.current, item.unit)} / {formatTarget(item.target, item.unit)} {item.unit}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700 ease-out"
                style={{ width: `${item.percent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-600">{item.percent}% complete</p>
          </div>
        ))}
      </div>

      <div className="soft-subcard mt-4 rounded-2xl p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coaching Nudges</p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          {payload.nudges.map((nudge) => (
            <li key={nudge}>• {nudge}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
