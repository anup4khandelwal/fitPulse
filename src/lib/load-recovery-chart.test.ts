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
});
