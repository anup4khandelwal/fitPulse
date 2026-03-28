# Training Load vs Recovery Chart Design

## Goal

Add a read-only `Training Load vs Recovery` analytics card to the home dashboard so users can compare recent training stress against recent recovery state over the last 28 days without introducing a new readiness score or recommendation engine.

## Scope

In scope for v1:

- A new home-page analytics card rendered near the existing recovery and trend modules
- A 28-day split-panel chart
- Daily weighted training load bars
- Daily composite recovery line with graceful HRV fallback
- A factual summary row for the current trailing 7-day period
- Ready, partial, and empty states
- Demo-mode support
- Unit coverage for scoring and payload rules

Out of scope for v1:

- Coaching callouts or recommendations
- Alerts integration
- New settings or user-configurable weights
- Schema changes
- Calendar integration
- A new derived readiness score

## User Experience

The card is titled `Training Load vs Recovery`.

It appears on the home page between the existing recovery and trend sections so it reads as cross-day analysis rather than day inspection.

The card uses a split layout with a shared date axis:

- Top panel: daily training load shown as bars
- Bottom panel: daily recovery score shown as a line
- Window: last 28 days ending today

Below the chart, the card shows four factual summary items:

- current 7-day average load
- current 7-day average recovery
- highest load day in the 28-day window
- recovery coverage label: `Full` or `Partial`

Coverage label rules:

- `Full`: at least 75% of recovery days in the 28-day window include HRV
- `Partial`: the chart renders, but HRV coverage is below that threshold

For coverage calculations, a `recovery day` means a day whose computed recovery score is not `null`.

If there is not enough recent recovery data, the card renders an empty state instead of a chart. The empty state explains that more synced sleep and recovery data is needed before the chart becomes useful.

## Data Sources

Use existing persisted data only:

- `dailyHeartZones` for `zone2Minutes`, `cardioMinutes`, `peakMinutes`, and `restingHeartRate`
- `dailySleep` for daily sleep inputs and derived sleep score
- `dailyRecovery` for `hrvRmssd`
- existing sleep score helper in `src/lib/sleep-score.ts`

Do not use steps or generic active minutes in the v1 load score. They would double-count effort already represented by the heart-zone data.

## Analytics Rules

### Training Load

Each day gets a weighted load score derived from heart-zone minutes:

```text
load = (zone2Minutes * 1.0) + (cardioMinutes * 1.75) + (peakMinutes * 2.5)
```

Rules:

- Missing heart-zone rows count as zero load for that day
- Null `cardioMinutes` and `peakMinutes` are treated as `0`
- The chart renders load bars for every day in the 28-day window, including zero-load days

### Recovery Score

Recovery is a composite `0-100` score built from whichever components are available on a given day:

- sleep score
- resting heart rate relative to rolling baseline
- HRV relative to rolling baseline

#### Component Weights

When all three components are available:

- sleep score: 50%
- resting heart rate score: 25%
- HRV score: 25%

When HRV is missing:

- sleep score: 65%
- resting heart rate score: 35%

When sleep score is missing but resting heart rate and HRV are available:

- resting heart rate score: 50%
- HRV score: 50%

When only one component is available:

- use that component as the recovery score

When none of the components are available:

- recovery is `null` for that day and the line breaks

#### Sleep Component

Use the existing derived daily sleep score directly as the sleep component. This is already normalized to `0-100`.

#### Resting Heart Rate Component

Compute a 14-day rolling baseline from the prior 14 valid resting-heart-rate days, excluding the current day.

`Prior 14 valid days` means the most recent 14 earlier data points with non-null values, not merely the previous 14 calendar dates.

If both a current-day value and a valid baseline exist, compute:

```text
rhrDeltaRatio = (currentRhr - baselineRhr) / baselineRhr
rhrScore = clamp(100 - (rhrDeltaRatio * 250), 0, 100)
```

Interpretation:

- higher-than-baseline RHR lowers recovery
- lower-than-baseline RHR improves recovery up to the `100` cap

If there is no valid prior baseline, exclude the RHR component from that day instead of inventing one.

#### HRV Component

Compute a 14-day rolling baseline from the prior 14 valid HRV days, excluding the current day.

`Prior 14 valid days` means the most recent 14 earlier data points with non-null values, not merely the previous 14 calendar dates.

If both a current-day value and a valid baseline exist, compute:

```text
hrvDeltaRatio = (currentHrv - baselineHrv) / baselineHrv
hrvScore = clamp(100 + (hrvDeltaRatio * 250), 0, 100)
```

Interpretation:

- higher-than-baseline HRV improves recovery
- lower-than-baseline HRV reduces recovery

If there is no valid prior baseline, exclude the HRV component from that day.

#### Recovery Sufficiency Threshold

The chart may render only when at least 7 days in the 28-day window have one or more valid recovery components.

If fewer than 7 days qualify, return the empty state payload.

## Payload Shape

Add a dedicated payload builder instead of extending the existing trend or recovery payloads. This feature combines daily series data, rolling baselines, and card-level metadata that do not fit cleanly into the current modules.

Proposed server payload:

```ts
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
```

State rules:

- `ready`: chart renders and HRV coverage is `Full`
- `partial`: chart renders and HRV coverage is `Partial`
- `empty`: the chart is replaced by an explanatory empty state

Summary rules:

- `avgLoad7d` is the mean of all 7 trailing daily load values, including zeros
- `avgRecovery7d` is the mean of the trailing 7 recovery values that are not `null`; if none are valid, it is `null`
- `highestLoadDate` is the most recent date with the maximum load value in the 28-day window

## Architecture

Add one new server-side analytics module and one focused UI component.

### New Server Module

Create `src/lib/load-recovery-chart.ts`.

Responsibilities:

- query the last 28 days of heart-zone, sleep, and recovery data
- build a per-day map for the full window
- compute weighted load
- compute sleep score from the existing helper
- compute rolling RHR and HRV baselines
- compute daily recovery with component fallback and reweighting
- compute 7-day summary values
- determine `Full` vs `Partial` recovery coverage
- determine `ready`, `partial`, or `empty` payload state
- build a demo payload from existing demo-oriented dashboard data

Do not put scoring math in the React component.

### New UI Component

Create `src/components/load-recovery-chart.tsx`.

Responsibilities:

- render the card title and short description
- render the split-panel visualization
- render the shared date axis
- render the summary row
- render a coverage badge
- render the empty state when `state === "empty"`

The component remains presentational. It receives a fully computed payload and does not fetch or derive analytics itself.

### Home Page Integration

Update `src/app/page.tsx` to:

- load the new payload in both real-data and demo-mode flows
- render the new card after `RecoverySignals` and before `TrendCards`

## Demo Mode

The repo already supports demo mode for home-page analytics. This feature must do the same.

Demo rules:

- derive the load series from the existing demo day data already produced for the calendar/dashboard
- derive the recovery series from demo sleep score, resting heart rate, and synthetic HRV coverage
- ensure demo data produces a non-empty chart by default
- include some HRV-missing days so the `Partial` state is easy to exercise in development and tests

## Visual Behavior

The chart should remain intentionally simple for v1.

Guidelines:

- no dual axis
- no smoothing or rolling-average lines in the main chart
- preserve daily spikes in load
- allow the recovery line to break on null days
- use the existing card styling language in the app

This card is analytical, not prescriptive. The copy should stay factual and avoid coaching tone.

## Testing Strategy

Prioritize lib-level correctness over UI-heavy testing.

Required unit coverage:

- weighted load calculation
- RHR component scoring against baseline
- HRV component scoring against baseline
- recovery score reweighting when HRV is missing
- recovery score behavior when only one component exists
- recovery insufficiency threshold for the empty state
- summary calculations for trailing 7-day values
- coverage label calculation for `Full` vs `Partial`

Optional UI coverage:

- one smoke-level render path for `ready`
- one render path for `empty`

## Risks And Guardrails

Main risks:

- overfitting a recovery score from noisy biometric inputs
- hiding missing data behind false precision
- double-counting activity load

Guardrails:

- keep the score relative, simple, and explicitly tied to available inputs
- expose `Partial` coverage instead of pretending HRV exists
- use heart-zone load only in v1
- keep the feature read-only and factual

## File Plan

Expected files:

- Create: `src/lib/load-recovery-chart.ts`
- Create: `src/components/load-recovery-chart.tsx`
- Modify: `src/app/page.tsx`
- Create or modify: a Vitest file covering payload/scoring behavior, most likely `src/lib/load-recovery-chart.test.ts`

## Acceptance Criteria

- Home page shows a new `Training Load vs Recovery` card
- The card renders a 28-day split chart with load bars and a recovery line
- The card uses weighted zone-based load, not steps or generic active minutes
- Recovery uses sleep score, RHR baseline, and HRV baseline when available
- Missing HRV degrades to a `Partial` chart state rather than breaking the feature
- Insufficient recovery data yields an empty state
- Demo mode supports the feature
- Unit tests cover core analytics rules
