import { describe, expect, it } from "vitest";

import {
  calculateTrainingLoad,
  combineRecoveryScore,
  scoreHrv,
  scoreRestingHeartRate,
} from "@/lib/load-recovery-chart";

describe("calculateTrainingLoad", () => {
  it("weights zone 2, cardio, and peak minutes", () => {
    expect(
      calculateTrainingLoad({
        zone2Minutes: 60,
        cardioMinutes: 10,
        peakMinutes: 5,
      }),
    ).toBe(90);
  });

  it("treats missing cardio and peak minutes as zero", () => {
    expect(
      calculateTrainingLoad({
        zone2Minutes: 45,
        cardioMinutes: null,
        peakMinutes: null,
      }),
    ).toBe(45);
  });
});

describe("recovery component scoring", () => {
  it("scores elevated resting heart rate below baseline", () => {
    expect(scoreRestingHeartRate(55, 50)).toBe(75);
  });

  it("scores lower-than-baseline HRV below 100", () => {
    expect(scoreHrv(36, 40)).toBe(75);
  });

  it.each([null, 0, -1])(
    "returns null for invalid resting heart rate baseline %s",
    (baselineRhr) => {
      expect(scoreRestingHeartRate(55, baselineRhr)).toBeNull();
    },
  );

  it("returns null for NaN resting heart rate baseline", () => {
    expect(scoreRestingHeartRate(55, Number.NaN)).toBeNull();
  });

  it.each([null, 0, -1])("returns null for invalid HRV baseline %s", (baselineHrv) => {
    expect(scoreHrv(36, baselineHrv)).toBeNull();
  });

  it("returns null for NaN HRV baseline", () => {
    expect(scoreHrv(36, Number.NaN)).toBeNull();
  });

  it("clamps resting heart rate scores to 0", () => {
    expect(scoreRestingHeartRate(100, 50)).toBe(0);
  });

  it("clamps resting heart rate scores to 100", () => {
    expect(scoreRestingHeartRate(10, 50)).toBe(100);
  });

  it("clamps HRV scores to 0", () => {
    expect(scoreHrv(0, 40)).toBe(0);
  });

  it("clamps HRV scores to 100", () => {
    expect(scoreHrv(60, 40)).toBe(100);
  });

  it("reweights recovery when HRV is missing", () => {
    expect(
      combineRecoveryScore({
        sleepScore: 80,
        rhrScore: 75,
        hrvScore: null,
      }),
    ).toBe(78.3);
  });

  it("uses the only available component as the recovery score", () => {
    expect(
      combineRecoveryScore({
        sleepScore: null,
        rhrScore: 67,
        hrvScore: null,
      }),
    ).toBe(67);
  });

  it("uses the 50/25/25 recovery weighting when all components are present", () => {
    expect(
      combineRecoveryScore({
        sleepScore: 80,
        rhrScore: 75,
        hrvScore: 50,
      }),
    ).toBe(71.3);
  });

  it("uses the 50/50 recovery weighting when only RHR and HRV are present", () => {
    expect(
      combineRecoveryScore({
        sleepScore: null,
        rhrScore: 75,
        hrvScore: 65,
      }),
    ).toBe(70);
  });

  it("returns null when all recovery components are missing", () => {
    expect(
      combineRecoveryScore({
        sleepScore: null,
        rhrScore: null,
        hrvScore: null,
      }),
    ).toBeNull();
  });
});
