"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SettingsPanelProps = {
  connected: boolean;
  goals: {
    zone2TargetMinutes: number;
    avgSleepTargetHours: number;
    avgStepsTarget: number;
    sleepScoreMode: "fitbit" | "recovery";
  };
  alertPrefs: {
    minSleepHours: number;
    minAvgSteps: number;
    minZone2Days: number;
    maxRestingHrDelta: number;
    alertsEnabled: boolean;
  };
  lastSync: {
    trigger: string;
    status: string;
    fromDate: string;
    toDate: string;
    syncedDays: number;
    attempts: number;
    warnings: string[];
    lastError: string | null;
    startedAt: string;
    endedAt: string | null;
  } | null;
};

function formatDate(date: string | null) {
  if (!date) return "n/a";
  return new Date(date).toLocaleString();
}

export function SettingsPanel({ connected, goals, alertPrefs, lastSync }: SettingsPanelProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [zone2TargetMinutes, setZone2TargetMinutes] = useState(goals.zone2TargetMinutes);
  const [avgSleepTargetHours, setAvgSleepTargetHours] = useState(goals.avgSleepTargetHours);
  const [avgStepsTarget, setAvgStepsTarget] = useState(goals.avgStepsTarget);
  const [sleepScoreMode, setSleepScoreMode] = useState<"fitbit" | "recovery">(goals.sleepScoreMode);
  const [alertsEnabled, setAlertsEnabled] = useState(alertPrefs.alertsEnabled);
  const [minSleepHours, setMinSleepHours] = useState(alertPrefs.minSleepHours);
  const [minAvgSteps, setMinAvgSteps] = useState(alertPrefs.minAvgSteps);
  const [minZone2Days, setMinZone2Days] = useState(alertPrefs.minZone2Days);
  const [maxRestingHrDelta, setMaxRestingHrDelta] = useState(alertPrefs.maxRestingHrDelta);

  async function onSyncLast30Days() {
    setSyncing(true);
    setMessage("Syncing last 30 days...");

    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const response = await fetch(`/api/sync?from=${from}&to=${to}`, {
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string; warnings?: string[]; error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Sync failed");
        return;
      }

      const warningText = payload.warnings?.length ? ` Warnings: ${payload.warnings.join(" ")}` : "";
      setMessage(`${payload.message ?? "Sync finished."}${warningText}`);
      router.refresh();
    } catch {
      setMessage("Unexpected sync error.");
    } finally {
      setSyncing(false);
    }
  }

  async function onDisconnect() {
    const response = await fetch("/api/auth/fitbit/disconnect", {
      method: "POST",
    });

    if (response.ok) {
      setMessage("Fitbit disconnected. Tokens removed locally.");
      router.refresh();
      return;
    }

    setMessage("Unable to disconnect Fitbit.");
  }

  async function onSaveGoals() {
    setSavingGoals(true);
    setMessage("Saving goals...");

    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone2TargetMinutes: Math.round(zone2TargetMinutes),
          avgSleepTargetHours: Number(avgSleepTargetHours.toFixed(1)),
          avgStepsTarget: Math.round(avgStepsTarget),
          sleepScoreMode,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to save goals.");
        return;
      }

      setMessage("Goals saved.");
      router.refresh();
    } catch {
      setMessage("Unexpected goals save error.");
    } finally {
      setSavingGoals(false);
    }
  }

  async function onSaveAlerts() {
    setSavingAlerts(true);
    setMessage("Saving alert preferences...");

    try {
      const response = await fetch("/api/alerts/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertsEnabled,
          minSleepHours: Number(minSleepHours.toFixed(1)),
          minAvgSteps: Math.round(minAvgSteps),
          minZone2Days: Math.round(minZone2Days),
          maxRestingHrDelta: Number(maxRestingHrDelta.toFixed(1)),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to save alert preferences.");
        return;
      }

      setMessage("Alert preferences saved.");
      router.refresh();
    } catch {
      setMessage("Unexpected alert preferences save error.");
    } finally {
      setSavingAlerts(false);
    }
  }

  return (
    <div className="soft-card interactive-card fade-up d-2 space-y-4 rounded-3xl p-5">
      <h2 className="text-xl font-semibold text-slate-900">Fitbit Connection</h2>

      <div className="soft-subcard interactive-subcard rounded-2xl p-3">
        <p className="text-sm text-slate-700">Status: {connected ? "Connected" : "Not connected"}</p>
      </div>

      <div className="soft-subcard interactive-subcard rounded-2xl p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Last sync</p>
        {lastSync ? (
          <div className="mt-2 space-y-1">
            <p>
              {lastSync.status} via {lastSync.trigger} ({lastSync.syncedDays} day(s), {lastSync.attempts} attempt(s))
            </p>
            <p>
              Range: {lastSync.fromDate.slice(0, 10)} to {lastSync.toDate.slice(0, 10)}
            </p>
            <p>Started: {formatDate(lastSync.startedAt)}</p>
            <p>Ended: {formatDate(lastSync.endedAt)}</p>
            {lastSync.warnings.length > 0 ? <p>Warnings: {lastSync.warnings.join(" ")}</p> : null}
            {lastSync.lastError ? <p className="text-rose-700">Error: {lastSync.lastError}</p> : null}
          </div>
        ) : (
          <p className="mt-1">No sync runs yet.</p>
        )}
      </div>

      <div className="soft-subcard interactive-subcard rounded-2xl p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Weekly goals</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Zone 2 target (minutes)</span>
            <input
              type="number"
              min={0}
              value={zone2TargetMinutes}
              onChange={(event) => setZone2TargetMinutes(Number(event.target.value))}
              className="rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Avg sleep target (hours)</span>
            <input
              type="number"
              min={0}
              max={24}
              step={0.1}
              value={avgSleepTargetHours}
              onChange={(event) => setAvgSleepTargetHours(Number(event.target.value))}
              className="rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Avg steps target</span>
            <input
              type="number"
              min={0}
              value={avgStepsTarget}
              onChange={(event) => setAvgStepsTarget(Number(event.target.value))}
              className="rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Sleep score mode</span>
            <select
              value={sleepScoreMode}
              onChange={(event) => setSleepScoreMode(event.target.value as "fitbit" | "recovery")}
              className="rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              <option value="fitbit">Fitbit-style (50/25/25)</option>
              <option value="recovery">Strict recovery</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={onSaveGoals}
          disabled={savingGoals}
          className="mt-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingGoals ? "Saving..." : "Save goals"}
        </button>
      </div>

      <div className="soft-subcard interactive-subcard rounded-2xl p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Alerts</p>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={alertsEnabled}
            onChange={(event) => setAlertsEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>Enable in-app alerts</span>
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Min avg sleep (hours)</span>
            <input
              type="number"
              min={0}
              max={24}
              step={0.1}
              value={minSleepHours}
              onChange={(event) => setMinSleepHours(Number(event.target.value))}
              className="rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Min avg steps</span>
            <input
              type="number"
              min={0}
              value={minAvgSteps}
              onChange={(event) => setMinAvgSteps(Number(event.target.value))}
              className="rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Min zone 2 days/week</span>
            <input
              type="number"
              min={0}
              max={7}
              value={minZone2Days}
              onChange={(event) => setMinZone2Days(Number(event.target.value))}
              className="rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Max resting HR rise (bpm)</span>
            <input
              type="number"
              min={0}
              max={40}
              step={0.1}
              value={maxRestingHrDelta}
              onChange={(event) => setMaxRestingHrDelta(Number(event.target.value))}
              className="rounded-lg border border-slate-300/80 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={onSaveAlerts}
          disabled={savingAlerts}
          className="mt-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingAlerts ? "Saving..." : "Save alerts"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="/api/auth/fitbit/login"
          className="rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-700 hover:to-cyan-700"
        >
          Connect Fitbit
        </a>

        <button
          type="button"
          onClick={onDisconnect}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
        >
          Disconnect
        </button>

        <button
          type="button"
          onClick={onSyncLast30Days}
          disabled={syncing || !connected}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync last 30 days"}
        </button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
