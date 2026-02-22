import { describe, expect, it } from "vitest";

import { calculateSleepScore, calculateSleepScoreDetailed, type SleepScoreInput } from "@/lib/sleep-score";

const balancedInput: SleepScoreInput = {
  minutesAsleep: 450,
  timeInBed: 490,
  efficiency: 92,
  deepMinutes: 95,
  remMinutes: 105,
  wakeMinutes: 40,
};

const poorInput: SleepScoreInput = {
  minutesAsleep: 250,
  timeInBed: 430,
  efficiency: 58,
  deepMinutes: 20,
  remMinutes: 35,
  wakeMinutes: 180,
};

describe("calculateSleepScoreDetailed", () => {
  it("returns a 0-100 score and consistent breakdown for fitbit mode", () => {
    const score = calculateSleepScoreDetailed(balancedInput, 8, "fitbit");

    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.duration + score.depth + score.restoration).toBe(score.total);
    expect(score.duration).toBeLessThanOrEqual(50);
    expect(score.depth).toBeLessThanOrEqual(25);
    expect(score.restoration).toBeLessThanOrEqual(25);
  });

  it("returns a 0-100 score and consistent breakdown for recovery mode", () => {
    const score = calculateSleepScoreDetailed(balancedInput, 8, "recovery");

    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.duration + score.depth + score.restoration).toBe(score.total);
    expect(score.duration).toBeLessThanOrEqual(35);
    expect(score.depth).toBeLessThanOrEqual(20);
    expect(score.restoration).toBeLessThanOrEqual(45);
  });

  it("produces lower scores for poor sleep patterns", () => {
    const healthy = calculateSleepScoreDetailed(balancedInput, 8, "fitbit").total;
    const poor = calculateSleepScoreDetailed(poorInput, 8, "fitbit").total;

    expect(poor).toBeLessThan(healthy);
  });

  it("handles zero/edge values without NaN", () => {
    const edge = calculateSleepScoreDetailed(
      {
        minutesAsleep: 0,
        timeInBed: 0,
        efficiency: 0,
        deepMinutes: 0,
        remMinutes: 0,
        wakeMinutes: 0,
      },
      8,
      "fitbit",
    );

    expect(edge.total).toBeGreaterThanOrEqual(0);
    expect(edge.total).toBeLessThanOrEqual(100);
    expect(edge.duration).toBeGreaterThanOrEqual(0);
    expect(edge.depth).toBe(0);
    expect(edge.restoration).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(edge.total)).toBe(false);
  });
});

describe("calculateSleepScore", () => {
  it("matches detailed total", () => {
    const compact = calculateSleepScore(balancedInput, 8, "fitbit");
    const detailed = calculateSleepScoreDetailed(balancedInput, 8, "fitbit").total;

    expect(compact).toBe(detailed);
  });

  it("applies different weighting by mode", () => {
    const mixedInput: SleepScoreInput = {
      minutesAsleep: 360,
      timeInBed: 470,
      efficiency: 72,
      deepMinutes: 50,
      remMinutes: 60,
      wakeMinutes: 110,
    };
    const fitbit = calculateSleepScore(mixedInput, 8, "fitbit");
    const recovery = calculateSleepScore(mixedInput, 8, "recovery");

    expect(fitbit).not.toBe(recovery);
  });
});
