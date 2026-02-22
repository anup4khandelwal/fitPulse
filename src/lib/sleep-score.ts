export type SleepScoreInput = {
  minutesAsleep: number;
  timeInBed: number;
  efficiency: number;
  deepMinutes: number;
  remMinutes: number;
  wakeMinutes: number;
};

export type SleepScoreBreakdown = {
  duration: number;
  depth: number;
  restoration: number;
  total: number;
};

export type SleepScoreMode = "fitbit" | "recovery";

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function calculateSleepScoreDetailed(
  input: SleepScoreInput,
  sleepGoalHours = 8,
  mode: SleepScoreMode = "fitbit",
): SleepScoreBreakdown {
  const goalMinutes = Math.max(1, Math.round(sleepGoalHours * 60));
  const asleep = Math.max(0, input.minutesAsleep);
  const inBed = Math.max(1, input.timeInBed || input.minutesAsleep + input.wakeMinutes);
  const wake = Math.max(0, input.wakeMinutes);

  const durationGoal = clamp(0, asleep / goalMinutes, 1);
  const asleepVsAwake = clamp(0, 1 - wake / inBed, 1);
  const qualityRatio = (Math.max(0, input.deepMinutes) + Math.max(0, input.remMinutes)) / Math.max(1, asleep);
  const efficiencyNorm = clamp(0, input.efficiency / 100, 1);
  const restlessnessNorm = clamp(0, 1 - wake / inBed, 1);

  const weights = mode === "recovery" ? { duration: 35, depth: 20, restoration: 45 } : { duration: 50, depth: 25, restoration: 25 };

  const durationScore = weights.duration * clamp(0, durationGoal * 0.8 + asleepVsAwake * 0.2, 1);
  const qualityScore = weights.depth * clamp(0, qualityRatio / 0.5, 1);
  const restorationScore = weights.restoration * clamp(0, efficiencyNorm * 0.65 + restlessnessNorm * 0.35, 1);

  const total = clamp(0, durationScore + qualityScore + restorationScore, 100);
  return {
    duration: Math.round(durationScore),
    depth: Math.round(qualityScore),
    restoration: Math.round(restorationScore),
    total: Math.round(total),
  };
}

export function calculateSleepScore(input: SleepScoreInput, sleepGoalHours = 8, mode: SleepScoreMode = "fitbit") {
  return calculateSleepScoreDetailed(input, sleepGoalHours, mode).total;
}
