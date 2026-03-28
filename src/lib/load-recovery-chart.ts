type LoadInputs = {
  zone2Minutes: number;
  cardioMinutes: number | null;
  peakMinutes: number | null;
};

type RecoveryScoreInputs = {
  sleepScore: number | null;
  rhrScore: number | null;
  hrvScore: number | null;
};

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Number(value.toFixed(1));
}

export function calculateTrainingLoad({
  zone2Minutes,
  cardioMinutes,
  peakMinutes,
}: LoadInputs) {
  return round1(
    zone2Minutes * 1 + (cardioMinutes ?? 0) * 1.75 + (peakMinutes ?? 0) * 2.5,
  );
}

export function scoreRestingHeartRate(
  currentRhr: number | null,
  baselineRhr: number | null,
) {
  if (currentRhr === null || baselineRhr === null || baselineRhr <= 0) return null;
  const deltaRatio = (currentRhr - baselineRhr) / baselineRhr;
  return round1(clamp(0, 100 - deltaRatio * 250, 100));
}

export function scoreHrv(currentHrv: number | null, baselineHrv: number | null) {
  if (currentHrv === null || baselineHrv === null || baselineHrv <= 0) return null;
  const deltaRatio = (currentHrv - baselineHrv) / baselineHrv;
  return round1(clamp(0, 100 + deltaRatio * 250, 100));
}

export function combineRecoveryScore({
  sleepScore,
  rhrScore,
  hrvScore,
}: RecoveryScoreInputs) {
  if (sleepScore !== null && rhrScore !== null && hrvScore !== null) {
    return round1(sleepScore * 0.5 + rhrScore * 0.25 + hrvScore * 0.25);
  }
  if (sleepScore !== null && rhrScore !== null) {
    return round1(sleepScore * 0.65 + rhrScore * 0.35);
  }
  if (rhrScore !== null && hrvScore !== null) {
    return round1(rhrScore * 0.5 + hrvScore * 0.5);
  }
  if (sleepScore !== null) return round1(sleepScore);
  if (rhrScore !== null) return round1(rhrScore);
  if (hrvScore !== null) return round1(hrvScore);
  return null;
}
