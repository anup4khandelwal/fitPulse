import { AlertsFeed } from "@/components/alerts-feed";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { GoalsCoaching } from "@/components/goals-coaching";
import { LoadRecoveryChart } from "@/components/load-recovery-chart";
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
import {
  buildDemoLoadRecoveryChartPayload,
  getLoadRecoveryChartPayload,
} from "@/lib/load-recovery-chart";
import { buildDemoRecoverySignals, getRecoverySignals } from "@/lib/recovery-signals";
import { buildDemoWeightInsights, getWeightInsights } from "@/lib/weight-insights";
import { WeightWidget } from "@/components/weight-widget";
import { CoachingSummary } from "@/components/coaching-summary";

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
  const goalsPayload = buildGoalsPayload(payload.weeklySummary, goals);
  const trendPayloadPromise = isDemoMode
    ? Promise.resolve(buildDemoTrendPayload())
    : getTrendPayload(user.id);
  const sleepInsightsPromise = isDemoMode
    ? Promise.resolve(buildDemoSleepInsights(payload.days, goals.avgSleepTargetHours, goals.sleepScoreMode))
    : getSleepInsights(user.id, goals.avgSleepTargetHours, goals.sleepScoreMode);
  const stepInsightsPromise = isDemoMode
    ? Promise.resolve(buildDemoStepInsights(payload.days, goals.avgStepsTarget))
    : getStepInsights(user.id, goals.avgStepsTarget);
  const rhrZone2InsightsPromise = isDemoMode
    ? Promise.resolve(buildDemoRhrZone2Insights())
    : getRhrZone2Insights(user.id);
  const conditioningInsightsPromise = isDemoMode
    ? Promise.resolve(buildDemoConditioningInsights(payload.days))
    : getConditioningInsights(user.id);
  const loadRecoveryPayloadPromise = isDemoMode
    ? Promise.resolve(buildDemoLoadRecoveryChartPayload(payload.days))
    : getLoadRecoveryChartPayload(user.id, goals.avgSleepTargetHours, goals.sleepScoreMode);
  const recoverySignalsPromise = isDemoMode
    ? Promise.resolve(buildDemoRecoverySignals(payload.days))
    : getRecoverySignals(user.id);
  const weightInsightsPromise = isDemoMode
    ? Promise.resolve(buildDemoWeightInsights())
    : getWeightInsights(user.id);
  const alertsPromise = listRecentAlerts(user.id, 8);

  const [
    trendPayload,
    sleepInsights,
    stepInsights,
    rhrZone2Insights,
    conditioningInsights,
    loadRecoveryPayload,
    recoverySignals,
    weightInsights,
    alerts,
  ] = await Promise.all([
    trendPayloadPromise,
    sleepInsightsPromise,
    stepInsightsPromise,
    rhrZone2InsightsPromise,
    conditioningInsightsPromise,
    loadRecoveryPayloadPromise,
    recoverySignalsPromise,
    weightInsightsPromise,
    alertsPromise,
  ]);

  return (
    <div className="space-y-5">
      <div className="hero-card fade-up d-1 rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400">Health Intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">Daily Health Calendar</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400 md:text-base">
              Track steps, sleep, exercise, and Zone 2 training in a unified month view.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-6 rounded-2xl border border-white/8 bg-white/4 px-6 py-4">
            <div className="flex flex-col items-center gap-0.5">
              <span className="stat-value text-3xl font-bold text-teal-400 md:text-4xl">
                {payload.weeklySummary.totalZone2Minutes}
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Zone 2 min</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="stat-value text-3xl font-bold text-sky-400 md:text-4xl">
                {payload.weeklySummary.averageSleepHours.toFixed(1)}h
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Avg sleep</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="stat-value text-3xl font-bold text-cyan-400 md:text-4xl">
                {payload.weeklySummary.averageSteps.toLocaleString()}
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Avg steps</span>
            </div>
          </div>
        </div>
      </div>
      <GoalsCoaching payload={goalsPayload} />
      <StepInsights payload={stepInsights} />
      <SleepInsights payload={sleepInsights} mode={goals.sleepScoreMode} />
      <RhrZone2Insights payload={rhrZone2Insights} />
      <ConditioningInsights payload={conditioningInsights} />
      <RecoverySignals payload={recoverySignals} />
      <WeightWidget payload={weightInsights} />
      <CoachingSummary />
      <LoadRecoveryChart payload={loadRecoveryPayload} />
      <AlertsFeed alerts={alerts} />
      <TrendCards payload={trendPayload} />
      <DashboardCalendar payload={payload} isDemo={isDemoMode} />
    </div>
  );
}
