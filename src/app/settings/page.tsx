import { SettingsPanel } from "@/components/settings-panel";
import { getOrCreateAlertPreferences } from "@/lib/alerts";
import { getOrCreateSingleUser } from "@/lib/dashboard";
import { demoModeForced } from "@/lib/env";
import { getOrCreateWeeklyGoals } from "@/lib/goals";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await getOrCreateSingleUser();
  const auth = await prisma.fitbitAuth.findUnique({ where: { userId: user.id } });
  const goals = await getOrCreateWeeklyGoals(user.id);
  const alertPrefs = await getOrCreateAlertPreferences(user.id);
  const lastSync = await prisma.syncRun.findFirst({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
  });
  const isDemoMode = demoModeForced || !auth;

  return (
    <div className="space-y-5">
      <div className="hero-card fade-up d-1 rounded-3xl p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Preferences</p>
        <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Connect Fitbit OAuth, trigger manual sync, or disconnect local tokens.
        </p>
      </div>

      {isDemoMode && !auth ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Demo mode is enabled. Connect Fitbit and sync to replace mock data with real data.
        </div>
      ) : null}

      <SettingsPanel
        connected={Boolean(auth)}
        goals={goals}
        alertPrefs={alertPrefs}
        lastSync={
          lastSync
            ? {
                trigger: lastSync.trigger,
                status: lastSync.status,
                fromDate: lastSync.fromDate.toISOString(),
                toDate: lastSync.toDate.toISOString(),
                syncedDays: lastSync.syncedDays,
                attempts: lastSync.attempts,
                warnings: lastSync.warnings ? lastSync.warnings.split("\n") : [],
                lastError: lastSync.lastError,
                startedAt: lastSync.startedAt.toISOString(),
                endedAt: lastSync.endedAt?.toISOString() ?? null,
              }
            : null
        }
      />
    </div>
  );
}
