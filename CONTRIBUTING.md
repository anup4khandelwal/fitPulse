# Contributing to fitPulse

Thanks for contributing. This project aims for practical, high-signal fitness analytics with clean UX.

## Local setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma generate
npm run dev
```

## Development standards

- Keep changes focused and reviewable.
- Prefer API-backed metrics over assumptions.
- Label derived metrics clearly in UI.
- Do not commit secrets or personal tokens.

## Before opening a PR

```bash
npm run lint
npm run build
```

Include:

- Problem statement
- Solution summary
- Screenshots for UI changes
- Testing notes

## Branch and commit style

- Branch: `feat/...`, `fix/...`, `chore/...`
- Commit messages: imperative and specific

## Good first contributions

- Improve onboarding docs
- Add tests around score/insight logic
- Add data-source labels on any remaining ambiguous cards
- Improve empty states and loading UX
