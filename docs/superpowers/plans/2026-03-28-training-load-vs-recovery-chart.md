# Training Load vs Recovery Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only home-page chart that compares daily weighted training load with a 0-100 recovery score over the last 28 days, including partial and empty states in both real-data and demo-mode flows.

**Architecture:** Put all scoring, baselines, fallback handling, and summary generation in a new server-side analytics module so the React component stays presentational. Use one pure history-to-payload transformer for both database-backed and demo-mode data, then verify behavior with Vitest before wiring the component into `src/app/page.tsx`.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Prisma, date-fns, Vitest

---

## File Structure

- `src/lib/load-recovery-chart.ts`
  Responsibility: export the payload types plus pure helpers for weighted load, RHR/HRV scoring, recovery combination, historical payload assembly, database-backed payload loading, and demo payload loading.
- `src/lib/load-recovery-chart.test.ts`
  Responsibility: lock the analytics contract with targeted unit coverage for load weights, baseline-relative recovery scoring, fallback reweighting, payload states, summaries, and tie-breaking.
- `src/components/load-recovery-chart.tsx`
  Responsibility: render the split-panel card, summary row, recovery coverage badge, and empty state from a precomputed payload.
- `src/app/page.tsx`
  Responsibility: fetch the new payload in both real-data and demo-mode paths and place the new card between `RecoverySignals` and `TrendCards`.

Implementation note:

- Do not add a `.tsx` component test in this plan. The current `vitest.config.ts` is `environment: "node"` and only includes `src/**/*.test.ts`, so keep verification focused on lib-level tests, lint, and `npx tsc --noEmit`.

### Task 1: Lock the analytics contract with failing tests

**Files:**
- Create: `src/lib/load-recovery-chart.test.ts`
- Create: `src/lib/load-recovery-chart.ts`
- Test: `src/lib/load-recovery-chart.test.ts`

- [ ] **Step 1: Write the failing scoring tests**

Create `src/lib/load-recovery-chart.test.ts` with the initial scoring contract:

```ts
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
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
npx vitest run src/lib/load-recovery-chart.test.ts --coverage=false
```

Expected: FAIL with a module resolution error for `@/lib/load-recovery-chart` or missing exported functions.

- [ ] **Step 3: Write the minimal scoring helpers**

Create `src/lib/load-recovery-chart.ts` with the smallest possible implementation that satisfies the initial tests:

```ts
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

export function calculateTrainingLoad({ zone2Minutes, cardioMinutes, peakMinutes }: LoadInputs) {
  return round1(zone2Minutes * 1 + (cardioMinutes ?? 0) * 1.75 + (peakMinutes ?? 0) * 2.5);
}

export function scoreRestingHeartRate(currentRhr: number | null, baselineRhr: number | null) {
  if (currentRhr === null || baselineRhr === null || baselineRhr <= 0) return null;
  const deltaRatio = (currentRhr - baselineRhr) / baselineRhr;
  return round1(clamp(0, 100 - deltaRatio * 250, 100));
}

export function scoreHrv(currentHrv: number | null, baselineHrv: number | null) {
  if (currentHrv === null || baselineHrv === null || baselineHrv <= 0) return null;
  const deltaRatio = (currentHrv - baselineHrv) / baselineHrv;
  return round1(clamp(0, 100 + deltaRatio * 250, 100));
}

export function combineRecoveryScore({ sleepScore, rhrScore, hrvScore }: RecoveryScoreInputs) {
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
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run:

```bash
npx vitest run src/lib/load-recovery-chart.test.ts --coverage=false
```

Expected: PASS with 6 passing tests in `src/lib/load-recovery-chart.test.ts`.

- [ ] **Step 5: Commit the scoring contract**

Run:

```bash
git add src/lib/load-recovery-chart.ts src/lib/load-recovery-chart.test.ts
git commit -m "feat: add load recovery scoring helpers"
```

### Task 2: Build the historical payload, DB loader, and demo loader

**Files:**
- Modify: `src/lib/load-recovery-chart.test.ts`
- Modify: `src/lib/load-recovery-chart.ts`
- Test: `src/lib/load-recovery-chart.test.ts`

- [ ] **Step 1: Expand the test file with payload-builder scenarios**

Replace `src/lib/load-recovery-chart.test.ts` with the full contract below so the payload assembly rules are locked before implementation:

```ts
import { addDays, format } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  buildLoadRecoveryChartPayloadFromDays,
  calculateTrainingLoad,
  combineRecoveryScore,
  scoreHrv,
  scoreRestingHeartRate,
  type LoadRecoverySourceDay,
} from "@/lib/load-recovery-chart";

function sourceDay(date: string, overrides: Partial<LoadRecoverySourceDay> = {}): LoadRecoverySourceDay {
  return {
    date,
    zone2Minutes: 20,
    cardioMinutes: 0,
    peakMinutes: 0,
    restingHeartRate: 56,
    sleepScore: 80,
    hrvRmssd: 40,
    ...overrides,
  };
}

function history(
  overrides: (index: number, date: string) => Partial<LoadRecoverySourceDay> = () => ({}),
): LoadRecoverySourceDay[] {
  const start = new Date("2026-02-15T00:00:00.000Z");
  return Array.from({ length: 42 }, (_, index) => {
    const date = format(addDays(start, index), "yyyy-MM-dd");
    return sourceDay(date, overrides(index, date));
  });
}

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

describe("buildLoadRecoveryChartPayloadFromDays", () => {
  it("returns a ready payload with 28 points and a 7-day summary", () => {
    const days = history((index) => {
      if (index < 35) return {};
      return {
        zone2Minutes: (index - 34) * 10,
      };
    });

    const payload = buildLoadRecoveryChartPayloadFromDays(days);

    expect(payload.state).toBe("ready");
    if (payload.state === "empty") throw new Error("expected chart payload");
    expect(payload.points).toHaveLength(28);
    expect(payload.summary.avgLoad7d).toBe(40);
    expect(payload.summary.avgRecovery7d).toBe(90);
    expect(payload.summary.highestLoadDate).toBe("2026-03-28");
    expect(payload.summary.highestLoadValue).toBe(70);
    expect(payload.summary.recoveryCoverage).toBe("full");
  });

  it("returns partial when HRV coverage drops below 75 percent", () => {
    const days = history((index) => ({
      hrvRmssd: index % 3 === 0 ? null : 40,
    }));

    const payload = buildLoadRecoveryChartPayloadFromDays(days);

    expect(payload.state).toBe("partial");
    if (payload.state === "empty") throw new Error("expected chart payload");
    expect(payload.summary.recoveryCoverage).toBe("partial");
    expect(payload.points.some((point) => point.hasHrv === false)).toBe(true);
  });

  it("returns empty when fewer than 7 recent days have any recovery input", () => {
    const days = history((index) => {
      if (index < 36) {
        return {
          sleepScore: null,
          restingHeartRate: null,
          hrvRmssd: null,
        };
      }
      return {
        sleepScore: 80,
        restingHeartRate: 56,
        hrvRmssd: null,
      };
    });

    const payload = buildLoadRecoveryChartPayloadFromDays(days);

    expect(payload.state).toBe("empty");
    expect(payload.reason).toContain("Need at least 7 recent recovery days");
    expect(payload.points).toHaveLength(28);
  });

  it("uses the most recent date when multiple days tie for the highest load", () => {
    const days = history((index) => {
      if (index === 39 || index === 41) {
        return { zone2Minutes: 80 };
      }
      return {};
    });

    const payload = buildLoadRecoveryChartPayloadFromDays(days);

    if (payload.state === "empty") throw new Error("expected chart payload");
    expect(payload.summary.highestLoadDate).toBe("2026-03-28");
    expect(payload.summary.highestLoadValue).toBe(80);
  });
});
```

- [ ] **Step 2: Run the targeted test to verify the new cases fail**

Run:

```bash
npx vitest run src/lib/load-recovery-chart.test.ts --coverage=false
```

Expected: FAIL with missing exports such as `buildLoadRecoveryChartPayloadFromDays` and `LoadRecoverySourceDay`.

- [ ] **Step 3: Extend the lib with payload types and the pure history transformer**

Update `src/lib/load-recovery-chart.ts` so it exports the source/payload types plus the history-driven builder:

```ts
import { addDays, format, startOfDay, subDays } from "date-fns";

export type LoadRecoverySourceDay = {
  date: string;
  zone2Minutes: number;
  cardioMinutes: number | null;
  peakMinutes: number | null;
  restingHeartRate: number | null;
  sleepScore: number | null;
  hrvRmssd: number | null;
};

export type LoadRecoveryChartPoint = {
  date: string;
  load: number;
  recovery: number | null;
  hasHrv: boolean;
};

export type LoadRecoverySummary = {
  avgLoad7d: number;
  avgRecovery7d: number | null;
  highestLoadDate: string | null;
  highestLoadValue: number;
  recoveryCoverage: "full" | "partial";
};

export type LoadRecoveryChartPayload =
  | {
      state: "ready" | "partial";
      points: LoadRecoveryChartPoint[];
      summary: LoadRecoverySummary;
    }
  | {
      state: "empty";
      reason: string;
      points: LoadRecoveryChartPoint[];
      summary: null;
    };

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageOrNull(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null);
  return valid.length === 0 ? null : round1(average(valid));
}

function previousValidAverage(
  days: LoadRecoverySourceDay[],
  currentIndex: number,
  pick: (day: LoadRecoverySourceDay) => number | null,
) {
  const values: number[] = [];
  for (let index = currentIndex - 1; index >= 0 && values.length < 14; index -= 1) {
    const value = pick(days[index]);
    if (value !== null) {
      values.unshift(value);
    }
  }
  return values.length === 0 ? null : average(values);
}

function coverageLabel(points: LoadRecoveryChartPoint[]) {
  const recoveryDays = points.filter((point) => point.recovery !== null);
  if (recoveryDays.length === 0) return "partial" as const;
  const withHrv = recoveryDays.filter((point) => point.hasHrv).length;
  return withHrv / recoveryDays.length >= 0.75 ? "full" : "partial";
}

export function buildLoadRecoveryChartPayloadFromDays(days: LoadRecoverySourceDay[]): LoadRecoveryChartPayload {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const windowStart = Math.max(0, ordered.length - 28);

  const points = ordered.slice(windowStart).map((day, offset) => {
    const index = windowStart + offset;
    const rhrBaseline = previousValidAverage(ordered, index, (item) => item.restingHeartRate);
    const hrvBaseline = previousValidAverage(ordered, index, (item) => item.hrvRmssd);
    const rhrScore = scoreRestingHeartRate(day.restingHeartRate, rhrBaseline);
    const hrvScore = scoreHrv(day.hrvRmssd, hrvBaseline);
    const recovery = combineRecoveryScore({
      sleepScore: day.sleepScore,
      rhrScore,
      hrvScore,
    });

    return {
      date: day.date,
      load: calculateTrainingLoad(day),
      recovery,
      hasHrv: hrvScore !== null,
    };
  });

  const recoveryDays = points.filter((point) => point.recovery !== null);
  if (recoveryDays.length < 7) {
    return {
      state: "empty",
      reason: "Need at least 7 recent recovery days before this chart becomes reliable.",
      points,
      summary: null,
    };
  }

  const trailing7 = points.slice(-7);
  const highestLoadPoint = points.reduce((best, point) => {
    if (!best) return point;
    return point.load >= best.load ? point : best;
  }, null as LoadRecoveryChartPoint | null);
  const recoveryCoverage = coverageLabel(points);

  return {
    state: recoveryCoverage === "full" ? "ready" : "partial",
    points,
    summary: {
      avgLoad7d: round1(average(trailing7.map((point) => point.load))),
      avgRecovery7d: averageOrNull(trailing7.map((point) => point.recovery)),
      highestLoadDate: highestLoadPoint?.date ?? null,
      highestLoadValue: highestLoadPoint?.load ?? 0,
      recoveryCoverage,
    },
  };
}
```

- [ ] **Step 4: Add the database-backed and demo payload loaders**

Append the real-data and demo adapters to `src/lib/load-recovery-chart.ts` so the page can use the same payload shape in both modes:

```ts
import type { DayDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { calculateSleepScoreDetailed, type SleepScoreMode } from "@/lib/sleep-score";

export async function getLoadRecoveryChartPayload(
  userId: string,
  sleepGoalHours = 8,
  sleepScoreMode: SleepScoreMode = "fitbit",
) {
  const today = startOfDay(new Date());
  const from = subDays(today, 89);

  const [zones, sleeps, recoveryRows] = await Promise.all([
    prisma.dailyHeartZones.findMany({
      where: { userId, date: { gte: from, lte: today } },
      select: {
        date: true,
        zone2Minutes: true,
        cardioMinutes: true,
        peakMinutes: true,
        restingHeartRate: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.dailySleep.findMany({
      where: { userId, date: { gte: from, lte: today } },
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
    }),
    prisma.dailyRecovery.findMany({
      where: { userId, date: { gte: from, lte: today } },
      select: {
        date: true,
        hrvRmssd: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const dayMap = new Map<string, LoadRecoverySourceDay>();
  for (let date = from; date <= today; date = addDays(date, 1)) {
    dayMap.set(format(date, "yyyy-MM-dd"), {
      date: format(date, "yyyy-MM-dd"),
      zone2Minutes: 0,
      cardioMinutes: 0,
      peakMinutes: 0,
      restingHeartRate: null,
      sleepScore: null,
      hrvRmssd: null,
    });
  }

  for (const row of zones) {
    const key = format(row.date, "yyyy-MM-dd");
    const day = dayMap.get(key);
    if (!day) continue;
    day.zone2Minutes = row.zone2Minutes;
    day.cardioMinutes = row.cardioMinutes;
    day.peakMinutes = row.peakMinutes;
    day.restingHeartRate = row.restingHeartRate;
  }

  for (const row of sleeps) {
    const key = format(row.date, "yyyy-MM-dd");
    const day = dayMap.get(key);
    if (!day) continue;
    day.sleepScore = calculateSleepScoreDetailed(
      {
        minutesAsleep: row.minutesAsleep,
        timeInBed: row.timeInBed,
        efficiency: row.efficiency,
        deepMinutes: row.deepMinutes ?? 0,
        remMinutes: row.remMinutes ?? 0,
        wakeMinutes: row.wakeMinutes ?? 0,
      },
      sleepGoalHours,
      sleepScoreMode,
    ).total;
  }

  for (const row of recoveryRows) {
    const key = format(row.date, "yyyy-MM-dd");
    const day = dayMap.get(key);
    if (!day) continue;
    day.hrvRmssd = row.hrvRmssd;
  }

  return buildLoadRecoveryChartPayloadFromDays(Array.from(dayMap.values()));
}

function fallbackDemoSourceDays() {
  const today = startOfDay(new Date());
  return Array.from({ length: 42 }, (_, index) => {
    const date = subDays(today, 41 - index);
    const zone2Minutes = 20 + ((index * 7) % 50);
    return {
      date: format(date, "yyyy-MM-dd"),
      zone2Minutes,
      cardioMinutes: index % 4 === 0 ? 12 : 0,
      peakMinutes: index % 7 === 0 ? 6 : 0,
      restingHeartRate: 56 - (index % 5 === 0 ? 1 : 0),
      sleepScore: 78 + (index % 6),
      hrvRmssd: index % 3 === 0 ? null : 38 + (index % 5) * 2,
    };
  });
}

export function buildDemoLoadRecoveryChartPayload(days: DayDashboard[]) {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const sourceDays = days
    .filter((day) => day.date <= todayKey)
    .slice(-42)
    .map((day, index) => ({
      date: day.date,
      zone2Minutes: day.zone2Minutes,
      cardioMinutes: day.cardioMinutes,
      peakMinutes: day.peakMinutes,
      restingHeartRate: day.restingHeartRate,
      sleepScore: day.sleepScore,
      hrvRmssd: index % 3 === 0 ? null : 38 + (index % 5) * 2,
    }));

  return buildLoadRecoveryChartPayloadFromDays(sourceDays.length >= 28 ? sourceDays : fallbackDemoSourceDays());
}
```

- [ ] **Step 5: Run the targeted tests to verify the full analytics module passes**

Run:

```bash
npx vitest run src/lib/load-recovery-chart.test.ts --coverage=false
```

Expected: PASS with all scoring and payload tests green.

- [ ] **Step 6: Commit the analytics payload builder**

Run:

```bash
git add src/lib/load-recovery-chart.ts src/lib/load-recovery-chart.test.ts
git commit -m "feat: add load recovery chart payload builder"
```

### Task 3: Render the dashboard card and wire it into the home page

**Files:**
- Create: `src/components/load-recovery-chart.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/lib/load-recovery-chart.test.ts`

- [ ] **Step 1: Create the presentational dashboard card**

Create `src/components/load-recovery-chart.tsx` with a split-panel renderer that stays dumb and only consumes the payload:

```tsx
import type { LoadRecoveryChartPayload } from "@/lib/load-recovery-chart";

type Props = {
  payload: LoadRecoveryChartPayload;
};

function compactDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function roundLabel(value: number | null, suffix = "") {
  if (value === null) return "n/a";
  return `${value.toFixed(1)}${suffix}`;
}

function axisLabels(dates: string[]) {
  const indices = [0, 7, 14, 21, dates.length - 1].filter((index, position, array) => array.indexOf(index) === position);
  return indices.map((index) => ({
    index,
    label: compactDate(dates[index]),
  }));
}

function recoveryPath(values: Array<number | null>) {
  const width = 520;
  const height = 110;
  const padX = 8;
  const padY = 10;
  let drawing = false;

  return values
    .map((value, index) => {
      if (value === null) {
        drawing = false;
        return null;
      }
      const x = padX + (index * (width - padX * 2)) / Math.max(1, values.length - 1);
      const y = height - padY - (value / 100) * (height - padY * 2);
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command} ${x} ${y}`;
    })
    .filter((segment): segment is string => segment !== null)
    .join(" ");
}

export function LoadRecoveryChart({ payload }: Props) {
  if (payload.state === "empty") {
    return (
      <div className="soft-card interactive-card fade-up d-4 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Training Load vs Recovery</h2>
            <p className="mt-1 text-sm text-slate-600">Daily weighted effort compared against a 0-100 recovery score.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Empty</span>
        </div>
        <div className="soft-subcard mt-4 rounded-2xl p-4">
          <p className="text-sm font-semibold text-slate-900">Not enough recent recovery data</p>
          <p className="mt-1 text-sm text-slate-600">{payload.reason}</p>
        </div>
      </div>
    );
  }

  const dates = payload.points.map((point) => point.date);
  const maxLoad = Math.max(...payload.points.map((point) => point.load), 1);
  const path = recoveryPath(payload.points.map((point) => point.recovery));
  const labels = axisLabels(dates);

  return (
    <div className="soft-card interactive-card fade-up d-4 rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Training Load vs Recovery</h2>
          <p className="mt-1 text-sm text-slate-600">Daily weighted effort compared against a 0-100 recovery score.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            payload.summary.recoveryCoverage === "full"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {payload.summary.recoveryCoverage === "full" ? "Full recovery coverage" : "Partial recovery coverage"}
        </span>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Training Load</p>
          <div className="mt-3 flex h-28 items-end gap-1">
            {payload.points.map((point) => (
              <div key={point.date} className="flex-1 rounded-t-md bg-gradient-to-t from-teal-400 to-cyan-300" style={{ height: `${Math.max(8, (point.load / maxLoad) * 100)}%` }} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recovery</p>
          <svg viewBox="0 0 520 110" className="mt-3 h-28 w-full">
            <path d={path} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="flex justify-between text-[11px] font-medium text-slate-500">
          {labels.map((item) => (
            <span key={`${item.index}-${item.label}`}>{item.label}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">7d Avg Load</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{roundLabel(payload.summary.avgLoad7d)}</p>
        </div>
        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">7d Avg Recovery</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{roundLabel(payload.summary.avgRecovery7d)}</p>
        </div>
        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Highest Load Day</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{payload.summary.highestLoadDate ? compactDate(payload.summary.highestLoadDate) : "n/a"}</p>
        </div>
        <div className="soft-subcard rounded-2xl p-3">
          <p className="text-xs text-slate-500">Highest Load Value</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{roundLabel(payload.summary.highestLoadValue)}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the new payload and component into the home page**

Update `src/app/page.tsx` to load the payload in both branches and render the card after `RecoverySignals`:

```tsx
import { LoadRecoveryChart } from "@/components/load-recovery-chart";
import { buildDemoLoadRecoveryChartPayload, getLoadRecoveryChartPayload } from "@/lib/load-recovery-chart";

// inside Home(...)
const loadRecoveryPayload = isDemoMode
  ? buildDemoLoadRecoveryChartPayload(payload.days)
  : await getLoadRecoveryChartPayload(user.id, goals.avgSleepTargetHours, goals.sleepScoreMode);

// inside the returned JSX, after <RecoverySignals ... />
<RecoverySignals payload={recoverySignals} />
<LoadRecoveryChart payload={loadRecoveryPayload} />
<AlertsFeed alerts={alerts} />
<TrendCards payload={trendPayload} />
```

- [ ] **Step 3: Run lint to catch component and import issues**

Run:

```bash
npm run lint
```

Expected: PASS with exit code `0`.

- [ ] **Step 4: Run the analytics tests and a TypeScript smoke check**

Run:

```bash
npx vitest run src/lib/load-recovery-chart.test.ts --coverage=false
npx tsc --noEmit
```

Expected:

- `vitest`: PASS for `src/lib/load-recovery-chart.test.ts`
- `tsc`: no output and exit code `0`

- [ ] **Step 5: Commit the finished dashboard feature**

Run:

```bash
git add src/app/page.tsx src/components/load-recovery-chart.tsx src/lib/load-recovery-chart.ts src/lib/load-recovery-chart.test.ts
git commit -m "feat: add training load recovery dashboard chart"
```

## Plan Self-Check

- Spec coverage:
  - 28-day split-panel chart: Task 3
  - weighted zone-based load: Tasks 1-2
  - recovery score with RHR/HRV baselines and fallback: Tasks 1-2
  - full/partial/empty states: Tasks 2-3
  - demo-mode support: Task 2
  - home-page integration: Task 3
  - verification and tests: Tasks 1-3
- Placeholder scan:
  - no unresolved placeholders or deferred “handle later” steps remain
- Type consistency:
  - one payload type family is used end-to-end: `LoadRecoverySourceDay`, `LoadRecoveryChartPoint`, `LoadRecoverySummary`, `LoadRecoveryChartPayload`
