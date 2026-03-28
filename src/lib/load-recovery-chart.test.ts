import { addDays, format, subDays } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, calculateSleepScoreDetailedMock } = vi.hoisted(() => ({
  prismaMock: {
    dailyHeartZones: { findMany: vi.fn() },
    dailySleep: { findMany: vi.fn() },
    dailyRecovery: { findMany: vi.fn() },
  },
  calculateSleepScoreDetailedMock: vi.fn(() => ({
    duration: 0,
    depth: 0,
    restoration: 0,
    total: 90,
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/sleep-score", () => ({
  calculateSleepScoreDetailed: calculateSleepScoreDetailedMock,
}));

import {
  buildDemoLoadRecoveryChartPayload,
  buildLoadRecoveryChartPayloadFromDays,
  calculateTrainingLoad,
  combineRecoveryScore,
  getLoadRecoveryChartPayload,
  previousValidAverage,
  scoreHrv,
  scoreRestingHeartRate,
  type LoadRecoverySourceDay,
} from "@/lib/load-recovery-chart";

const HISTORY_START = new Date("2026-02-15T00:00:00.000Z");

function makeSourceDay(
  index: number,
  overrides: Partial<LoadRecoverySourceDay> = {},
): LoadRecoverySourceDay {
  return {
    date: format(addDays(HISTORY_START, index), "yyyy-MM-dd"),
    zone2Minutes: 0,
    cardioMinutes: null,
    peakMinutes: null,
    sleepScore: 90,
    restingHeartRate: null,
    hrvRmssd: 40,
    ...overrides,
  };
}

function makeHistory(
  overrides: (index: number, day: LoadRecoverySourceDay) => Partial<LoadRecoverySourceDay> = () => ({}),
): LoadRecoverySourceDay[] {
  return Array.from({ length: 42 }, (_, index) => {
    const day = makeSourceDay(index);
    return { ...day, ...overrides(index, day) };
  });
}

function makeDashboardDay(date: Date, overrides: Record<string, unknown> = {}) {
  return {
    date: format(date, "yyyy-MM-dd"),
    steps: 0,
    activeMinutes: 0,
    sedentaryMinutes: 0,
    lightlyActiveMins: 0,
    fairlyActiveMins: 0,
    veryActiveMins: 0,
    sleepMinutes: 480,
    sleepScore: 90,
    sleepScoreBreakdown: null,
    zone2Minutes: 20,
    cardioMinutes: 0,
    peakMinutes: 0,
    outOfRangeMinutes: 0,
    restingHeartRate: null,
    hasActivity: false,
    activities: [],
    sleep: {
      minutesAsleep: 480,
      timeInBed: 510,
      efficiency: 94,
      deepMinutes: 90,
      remMinutes: 100,
      lightMinutes: 290,
      wakeMinutes: 30,
      sleepStart: null,
      sleepEnd: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-28T12:00:00.000Z"));
  prismaMock.dailyHeartZones.findMany.mockReset();
  prismaMock.dailySleep.findMany.mockReset();
  prismaMock.dailyRecovery.findMany.mockReset();
  calculateSleepScoreDetailedMock.mockClear();
});

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

  it("rounds fractional resting heart rate scores to 1 decimal", () => {
    expect(scoreRestingHeartRate(50.5, 50)).toBe(97.5);
  });

  it("scores lower-than-baseline HRV below 100", () => {
    expect(scoreHrv(36, 40)).toBe(75);
  });

  it("rounds fractional HRV scores to 1 decimal", () => {
    expect(scoreHrv(39.6, 40)).toBe(97.5);
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

  it("uses sleep score when sleep and HRV are present but RHR is missing", () => {
    expect(
      combineRecoveryScore({
        sleepScore: 83,
        rhrScore: null,
        hrvScore: 91,
      }),
    ).toBe(83);
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

describe("previousValidAverage", () => {
  it("uses the most recent 14 earlier non-null values", () => {
    const days = makeHistory((index) => ({
      hrvRmssd: index < 4 ? null : 30 + index,
    }));

    expect(previousValidAverage(days, 20, (day) => day.hrvRmssd)).toBe(42.5);
  });
});

describe("buildLoadRecoveryChartPayloadFromDays", () => {
  it("builds a ready payload with 28 points and a 7-day summary", () => {
    const history = makeHistory((index) => ({
      zone2Minutes: index >= 35 ? (index - 34) * 10 : 0,
    })).reverse();

    const payload = buildLoadRecoveryChartPayloadFromDays(history);

    expect(payload.state).toBe("ready");
    expect(payload.points).toHaveLength(28);
    expect(payload.summary).toEqual({
      avgLoad7d: 40,
      avgRecovery7d: 90,
      highestLoadDate: "2026-03-28",
      highestLoadValue: 70,
      recoveryCoverage: "full",
    });
  });

  it("builds a partial payload when HRV coverage drops below full", () => {
    const history = makeHistory((index) => ({
      zone2Minutes: index >= 35 ? (index - 34) * 10 : 0,
      hrvRmssd: index % 3 === 0 ? null : 40,
    }));

    const payload = buildLoadRecoveryChartPayloadFromDays(history);

    expect(payload.state).toBe("partial");
    expect(payload.summary?.recoveryCoverage).toBe("partial");
    expect(payload.points.some((point) => point.hasHrv === false)).toBe(true);
  });

  it("builds an empty payload when fewer than 7 recent days have recovery input", () => {
    const history = makeHistory((index) => ({
      sleepScore: index >= 36 ? 90 : null,
      restingHeartRate: null,
      hrvRmssd: null,
    }));

    const payload = buildLoadRecoveryChartPayloadFromDays(history);

    expect(payload.state).toBe("empty");
    expect(payload.reason).toContain("Need at least 7 recent recovery days");
    expect(payload.points).toHaveLength(28);
  });

  it("uses the most recent date when multiple days tie for highest load", () => {
    const history = makeHistory((index) => ({
      zone2Minutes: index === 39 || index === 41 ? 80 : index >= 35 ? 40 : 0,
    }));

    const payload = buildLoadRecoveryChartPayloadFromDays(history);

    expect(payload.summary?.highestLoadDate).toBe("2026-03-28");
    expect(payload.summary?.highestLoadValue).toBe(80);
  });

  it("keeps avgRecovery7d null when the trailing week has no recovery values", () => {
    const history = makeHistory((index) => ({
      sleepScore: index >= 14 && index <= 20 ? 90 : null,
      restingHeartRate: null,
      hrvRmssd: null,
    }));

    const payload = buildLoadRecoveryChartPayloadFromDays(history);

    expect(payload.state).toBe("partial");
    expect(payload.summary?.avgRecovery7d).toBeNull();
  });
});

describe("buildDemoLoadRecoveryChartPayload", () => {
  it("adapts recent dashboard days into a chart payload", () => {
    const days = Array.from({ length: 28 }, (_, index) =>
      makeDashboardDay(subDays(new Date("2026-03-28T00:00:00.000Z"), 27 - index)),
    );

    const payload = buildDemoLoadRecoveryChartPayload(days);

    expect(payload.points).toHaveLength(28);
    expect(payload.state).toBe("partial");
    expect(payload.summary?.recoveryCoverage).toBe("partial");
  });

  it("falls back to synthetic history when there are not 28 usable recent demo days", () => {
    const days = Array.from({ length: 6 }, (_, index) =>
      makeDashboardDay(subDays(new Date("2026-03-28T00:00:00.000Z"), 5 - index)),
    );

    const payload = buildDemoLoadRecoveryChartPayload(days);

    expect(payload.points).toHaveLength(28);
    expect(payload.state).not.toBe("empty");
    expect(payload.summary).not.toBeNull();
  });
});

describe("getLoadRecoveryChartPayload", () => {
  it("loads the last 90 days from the database and builds the chart payload", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = subDays(today, 89);

    prismaMock.dailyHeartZones.findMany.mockResolvedValue(
      Array.from({ length: 90 }, (_, index) => ({
        date: addDays(from, index),
        zone2Minutes: index >= 83 ? (index - 82) * 10 : 0,
        cardioMinutes: null,
        peakMinutes: null,
        restingHeartRate: null,
      })),
    );
    prismaMock.dailySleep.findMany.mockResolvedValue(
      Array.from({ length: 90 }, (_, index) => ({
        date: addDays(from, index),
        minutesAsleep: 480,
        timeInBed: 510,
        efficiency: 94,
        deepMinutes: 90,
        remMinutes: 100,
        wakeMinutes: 30,
      })),
    );
    prismaMock.dailyRecovery.findMany.mockResolvedValue(
      Array.from({ length: 90 }, (_, index) => ({
        date: addDays(from, index),
        hrvRmssd: index % 3 === 0 ? null : 40,
      })),
    );

    const payload = await getLoadRecoveryChartPayload("user-1");

    expect(prismaMock.dailyHeartZones.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: { gte: from, lte: today },
      },
      select: {
        date: true,
        zone2Minutes: true,
        cardioMinutes: true,
        peakMinutes: true,
        restingHeartRate: true,
      },
      orderBy: { date: "asc" },
    });
    expect(prismaMock.dailySleep.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: { gte: from, lte: today },
      },
      select: {
        date: true,
        minutesAsleep: true,
        timeInBed: true,
        efficiency: true,
        deepMinutes: true,
        remMinutes: true,
        wakeMinutes: true,
      },
      orderBy: { date: "asc" },
    });
    expect(prismaMock.dailyRecovery.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: { gte: from, lte: today },
      },
      select: {
        date: true,
        hrvRmssd: true,
      },
      orderBy: { date: "asc" },
    });
    expect(calculateSleepScoreDetailedMock).toHaveBeenCalled();
    expect(payload.points).toHaveLength(28);
    expect(payload.state).toBe("partial");
  });
});
