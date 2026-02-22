import { AlertsFeed } from "@/components/alerts-feed";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { GoalsCoaching } from "@/components/goals-coaching";
import { ConditioningInsights } from "@/components/conditioning-insights";
import { RhrZone2Insights } from "@/components/rhr-zone2-insights";
import { RecoverySignals } from "@/components/recovery-signals";
import { SleepInsights } from "@/components/sleep-insights";
import { StepInsights } from "@/components/step-insights";
import { TrendCards } from "@/components/trend-cards";
import {
  buildDemoCalendarPayload,
  buildDemoTrendPayload,
  getCalendarPayload,
  getOrCreateSingleUser,
  getTrendPayload,
} from "@/lib/dashboard";
import { demoModeForced } from "@/lib/env";
import { buildGoalsPayload, getOrCreateWeeklyGoals } from "@/lib/goals";
import { listRecentAlerts } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";
import { buildDemoSleepInsights, getSleepInsights } from "@/lib/sleep-insights";
import { buildDemoStepInsights, getStepInsights } from "@/lib/steps-insights";
import { buildDemoRhrZone2Insights, getRhrZone2Insights } from "@/lib/rhr-zone2-insights";
import { buildDemoConditioningInsights, getConditioningInsights } from "@/lib/conditioning-insights";
import { buildDemoRecoverySignals, getRecoverySignals } from "@/lib/recovery-signals";

type HomeProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const month = params.month;
  const user = await getOrCreateSingleUser();
  const auth = await prisma.fitbitAuth.findUnique({ where: { userId: user.id } });
  const isDemoMode = demoModeForced || !auth;
  const goals = await getOrCreateWeeklyGoals(user.id);
  const payload = isDemoMode
    ? buildDemoCalendarPayload(month, goals.avgSleepTargetHours, goals.sleepScoreMode)
    : await getCalendarPayload(month, goals.avgSleepTargetHours, goals.sleepScoreMode);
  const trendPayload = isDemoMode ? buildDemoTrendPayload() : await getTrendPayload(user.id);
  const goalsPayload = buildGoalsPayload(payload.weeklySummary, goals);
  const sleepInsights = isDemoMode
    ? buildDemoSleepInsights(payload.days, goals.avgSleepTargetHours, goals.sleepScoreMode)
    : await getSleepInsights(user.id, goals.avgSleepTargetHours, goals.sleepScoreMode);
  const stepInsights = isDemoMode
    ? buildDemoStepInsights(payload.days, goals.avgStepsTarget)
    : await getStepInsights(user.id, goals.avgStepsTarget);
  const rhrZone2Insights = isDemoMode ? buildDemoRhrZone2Insights() : await getRhrZone2Insights(user.id);
  const conditioningInsights = isDemoMode
    ? buildDemoConditioningInsights(payload.days)
    : await getConditioningInsights(user.id);
  const recoverySignals = isDemoMode ? buildDemoRecoverySignals(payload.days) : await getRecoverySignals(user.id);
  const alerts = await listRecentAlerts(user.id, 8);

  return (
    <div className="space-y-5">
      <div className="hero-card fade-up d-1 rounded-3xl p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Daily Health Calendar</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
          Track steps, sleep, exercise, and Zone 2 (Fat Burn) minutes in a month view.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/80 px-3 py-1 text-teal-700 ring-1 ring-teal-100">
            {payload.weeklySummary.totalZone2Minutes}m zone 2 this week
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1 text-sky-700 ring-1 ring-sky-100">
            {payload.weeklySummary.averageSleepHours.toFixed(1)}h avg sleep
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1 text-cyan-700 ring-1 ring-cyan-100">
            {payload.weeklySummary.averageSteps.toLocaleString()} avg steps
          </span>
        </div>
      </div>
      <GoalsCoaching payload={goalsPayload} />
      <StepInsights payload={stepInsights} />
      <SleepInsights payload={sleepInsights} mode={goals.sleepScoreMode} />
      <RhrZone2Insights payload={rhrZone2Insights} />
      <ConditioningInsights payload={conditioningInsights} />
      <RecoverySignals payload={recoverySignals} />
      <AlertsFeed alerts={alerts} />
      <TrendCards payload={trendPayload} />
      <DashboardCalendar payload={payload} isDemo={isDemoMode} />
    </div>
  );
}
