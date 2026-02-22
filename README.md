# fitPulse

[![CI](https://github.com/anup4khandelwal/fitPulse/actions/workflows/ci.yml/badge.svg)](https://github.com/anup4khandelwal/fitPulse/actions/workflows/ci.yml)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A modern, open-source Fitbit dashboard focused on **real fitness outcomes**: conditioning, recovery, sleep, heart-zone training, and trend-based coaching.

If you are building better health from data, this repo is for you.

If this project is useful, please **star the repo** to help more people discover it.

## Why fitPulse

Most dashboards stop at vanity metrics. fitPulse is designed for:

- Daily readiness and recovery context
- Zone 2 consistency and intensity balance (80/20)
- Sleep quality and trends
- Weekly coaching signals from real Fitbit API data
- A clean, modern UX for daily use

## Core Features

- OAuth Fitbit integration
- Calendar-based health dashboard
- Sleep insights + derived sleep score breakdown
- Step insights + pacing + streaks
- RHR + Zone 2 planning
- Conditioning insights (active/sedentary balance, adherence)
- Recovery signals (VO2, HRV, breathing rate, SpO2, temperature)
- Alerts engine + preferences
- Auto-sync endpoint for cron workflows

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Prisma + SQLite
- Fitbit Web API

## Quick Start

```bash
npm install
cp .env.example .env   # create this file manually if not present
npx prisma migrate dev
npx prisma generate
npm run dev
```

Open: `http://localhost:3000`

## Environment Variables

Never commit real secrets. Use your own values locally:

```env
DATABASE_URL="file:./dev.db"
FITBIT_CLIENT_ID="your_client_id"
FITBIT_CLIENT_SECRET="your_client_secret"
FITBIT_REDIRECT_URI="http://localhost:3000/api/auth/fitbit/callback"
DEMO_MODE="false"
SYNC_CRON_SECRET="replace_with_long_random_secret"
AUTO_SYNC_DAYS="3"
```

## Fitbit API Coverage

fitPulse uses Fitbit APIs for:

- Daily activity summary (steps, active/sedentary, calories)
- Sleep logs + stages
- Heart rate zones + resting heart rate
- Cardio fitness / VO2 max
- HRV
- Breathing rate
- SpO2
- Temperature (when available)

Some metrics are intentionally labeled **Derived** where Fitbit does not provide a direct score endpoint.

## Roadmap

- Training load vs recovery chart
- Overtraining risk flag
- Strength and mobility tracking module
- Coach summary (weekly AI narrative)
- Mobile-first companion layout

## Contributing

Contributions are welcome.

1. Fork the repo
2. Create a feature branch
3. Make focused changes with clear commit messages
4. Open a PR with screenshots and test notes

Please keep PRs small and production-minded.

Contributor guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Support the Project

If fitPulse helps you, please:

- Star this repo
- Share it with friends building fitness dashboards
- Open issues for bugs/feature requests
- Contribute improvements

## Security

- Do not commit `.env` files or production tokens
- Revoke and rotate tokens if leaked
- Use separate Fitbit apps for local and production where possible

## License

MIT
