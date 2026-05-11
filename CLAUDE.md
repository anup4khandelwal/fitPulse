# fitPulse — Claude Code Guide

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run lint         # ESLint
npm run test:unit    # Vitest unit tests
npm run test:e2e     # Playwright e2e tests (starts dev server automatically)
npx tsc --noEmit     # type-check without emitting
npx prisma generate  # regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # create + apply a new migration
npx prisma migrate deploy             # apply existing migrations (CI)

# CLI — query health data from the terminal
npm run fitpulse -- summary                          # last 7 days steps/calories/active mins
npm run fitpulse -- sleep --from 2026-05-01          # sleep since May 1
npm run fitpulse -- zones --format json              # heart rate zones as JSON
npm run fitpulse -- recovery --format csv            # recovery biomarkers as CSV
npm run fitpulse -- weight                           # last 30 days weight/body fat/BMI
npm run fitpulse -- activities                       # exercise sessions last 7 days
npm run fitpulse -- status                           # last sync run status
npm run fitpulse -- sync --from 2026-05-01 --to 2026-05-10  # trigger sync (app must run)

# MCP server — exposes 8 tools for AI agents (Claude Code, Claude Desktop, etc.)
npm run mcp          # start MCP server over stdio
```

## Architecture

### Data flow
Google Health API → `src/lib/fitbit/sync.ts` → Prisma (SQLite) → lib query functions → React Server Components

### Key directories
- `src/lib/fitbit/` — OAuth client (`client.ts`) and sync engine (`sync.ts`)
- `src/lib/` — one file per feature: `sleep-insights.ts`, `recovery-signals.ts`, `weight-insights.ts`, etc. Each exports a `get*` function (real data) and a `buildDemo*` function (mock data for demo mode)
- `src/components/` — one component per widget, receives a typed payload prop, no data fetching
- `src/app/page.tsx` — dashboard: fetches all payloads in parallel with `Promise.all`, passes to components
- `src/app/api/` — API routes: `auth/fitbit/` (OAuth), `sync/` (manual sync), `sync/auto/` (cron), `webhooks/health/` (Google push notifications)

### Auth model
- Single-user app: `getOrCreateSingleUser()` always returns the same user row
- Tokens stored in `FitbitAuth` (table name kept for backward compat, stores Google OAuth tokens)
- `fitbitFetchWithAutoRefresh()` handles token refresh transparently

### Demo mode
- Active when `DEMO_MODE=true` OR no `FitbitAuth` row exists
- Every `buildDemo*` function in `src/lib/` generates 30 days of realistic mock data
- Checked in `src/app/page.tsx` and `src/app/settings/page.tsx` via `isDemoMode`

## Database

SQLite via Prisma. Schema at `prisma/schema.prisma`. Key models:
- `User` — single row
- `FitbitAuth` — Google OAuth tokens (access + refresh + expiry)
- `DailySummary` — steps, active/sedentary minutes, calories
- `DailySleep` — sleep duration, stages, efficiency
- `DailyHeartZones` — Zone 2, cardio, peak, resting HR
- `DailyRecovery` — VO2, HRV, SpO2, breathing rate, skin temp
- `ActivityLog` — individual exercise sessions
- `WeightLog` — weight (kg), body fat %, BMI
- `WeeklyGoal` / `AlertPreference` / `AlertEvent` / `SyncRun`

After any schema change: run `npx prisma migrate dev --name <desc>` then `npx prisma generate`.

## Google Health API

Base URL: `https://health.googleapis.com/v4`

Data is fetched via `fetchAllDataPoints<T>(userId, dataType, filter)` in `sync.ts`. Pagination handled automatically via `nextPageToken`.

Filter syntax:
- Interval types: `steps.interval.civil_start_time >= "YYYY-MM-DD" AND ...`
- Daily types: `daily_resting_heart_rate.date = "YYYY-MM-DD"`
- Sleep: `sleep.civil_end_time >= "YYYY-MM-DD" AND sleep.civil_end_time < "YYYY-MM-DD"`

Data types synced per day (13 total):
`steps`, `active-zone-minutes`, `sedentary-period`, `total-calories`, `sleep`, `daily-resting-heart-rate`, `daily-heart-rate-zones`, `daily-vo2-max`, `daily-heart-rate-variability`, `daily-respiratory-rate`, `daily-oxygen-saturation`, `daily-sleep-temperature-derivations`, `exercise`, `weight`, `body-fat`

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/fitbit/callback"
DEMO_MODE="false"
SYNC_CRON_SECRET=          # protects POST /api/sync/auto
AUTO_SYNC_DAYS="3"         # days back to sync in auto mode
WEBHOOK_SECRET=            # optional, validates Google Health webhook calls
ANTHROPIC_API_KEY=         # required for AI coaching summary (POST /api/coaching)
```

## MCP Server & CLI

Both live in `mcp-server/` and `cli/` and share a data layer (`mcp-server/db.ts` + `mcp-server/queries.ts`) that reads directly from the SQLite database using the same `@prisma/adapter-better-sqlite3` setup as the Next.js app. They do **not** depend on any Next.js runtime.

### MCP server tools (`mcp-server/index.ts`)
| Tool | Description |
|------|-------------|
| `get_daily_summary` | Steps, active/sedentary minutes, calories |
| `get_sleep` | Duration, efficiency, deep/REM/light/wake stages |
| `get_heart_rate_zones` | Zone 2, cardio, peak minutes + resting HR |
| `get_recovery_signals` | VO2 max, HRV, SpO2, breathing rate, skin temp |
| `get_weight` | Weight (kg), body fat %, BMI — 30-day default |
| `get_activities` | Exercise sessions with duration/calories/distance |
| `get_sync_status` | Last sync run status |
| `sync_data` | Trigger sync via app API (requires app running) |

MCP config is in `.mcp.json` — the `fitpulse` server entry starts `npm run mcp` automatically.

### CLI commands (`cli/index.ts`)
Supports `--from`/`--to` date flags and `--format table|json|csv|md` on every command.

## CI

Two jobs in `.github/workflows/ci.yml`:
1. `lint-build-unit` — lint, build, unit tests
2. `e2e` — Playwright against `npm run dev` (needs all `GOOGLE_*` env vars set as dummy values)

E2E tests are in `e2e/dashboard.spec.ts`.
