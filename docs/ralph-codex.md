# Ralph + Codex Integration

This repository includes a development scaffold to run Ralph planning and Codex execution in a repeatable loop.

## What is included

- Workflow: `.github/workflows/ralph-codex.yml`
- Local wrappers:
  - `scripts/agent/run-ralph.sh`
  - `scripts/agent/run-codex.sh`
- Output artifacts:
  - `docs/agent-plan.md`
  - `docs/codex-summary.md`
  - `docs/agent-log.md`

## Configure repository variables and secrets

Set these in GitHub repo settings:

- `Settings -> Secrets and variables -> Actions`

### Variables

- `RALPH_CMD`: command used for planning
  - Recommended: `codex exec --full-auto "Create an implementation plan for this task: {TASK}. Output markdown plan only, no code changes."`
- `CODEX_CMD`: command used for implementation
  - Recommended: `codex exec --full-auto "{TASK}"`

### Secrets

- `OPENAI_API_KEY` (for Codex CLI if required)
- `RALPH_API_KEY` (if your Ralph tooling needs it)
- `BOT_GH_TOKEN` (recommended) personal access token with `repo` scope for PR creation

## GitHub repository setting required

If you rely on default `GITHUB_TOKEN`, enable:

- `Settings -> Actions -> General -> Workflow permissions`
- Turn on `Allow GitHub Actions to create and approve pull requests`

## Run the automation

1. Open `Actions` tab
2. Select `Ralph + Codex Task Loop`
3. Click `Run workflow`
4. Enter task text
5. Optionally enable `run_e2e`

The workflow will:

1. Generate Prisma client and apply migrations
2. Run Ralph planning
3. Run Codex execution
4. Validate with lint/build/unit tests (plus optional e2e)
5. Open a PR with generated artifacts

## Local usage

```bash
export RALPH_CMD="npx ralph-cli plan"
export CODEX_CMD="npx codex-cli run"

./scripts/agent/run-ralph.sh "Add AZM trend chart"
./scripts/agent/run-codex.sh "Implement AZM endpoint and UI"
```

## Notes

- If `RALPH_CMD` or `CODEX_CMD` is not set, wrappers create fallback markdown so workflow still succeeds.
- This scaffold is intentionally tool-agnostic; swap commands to match your preferred Ralph/Codex clients.
- Workflow installs `@openai/codex` globally, so `codex` command is available in CI.
- Wrappers support either `{TASK}` placeholder or appending task as final argument.
