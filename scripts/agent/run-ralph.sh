#!/usr/bin/env bash
set -euo pipefail

TASK_RAW="${1:-}"
TASK="${TASK_RAW#"${TASK_RAW%%[![:space:]]*}"}"
TASK="${TASK%"${TASK##*[![:space:]]}"}"
if [[ -z "$TASK" ]]; then
  echo "Usage: run-ralph.sh \"<task>\""
  exit 1
fi

mkdir -p docs

default_plan_prompt() {
  local prompt_file="scripts/agent/prompts/ralph-plan.txt"
  if [[ -f "$prompt_file" ]]; then
    local template
    template="$(cat "$prompt_file")"
    printf "%s" "${template//\{\{TASK\}\}/$TASK}"
    return 0
  fi

  cat <<EOF
You are Ralph, the planning assistant. Create an implementation plan for this task:

$TASK

Output markdown only with these headings:
1. Goal
2. Constraints
3. Step-by-step plan
4. Risks and mitigations
5. Validation checklist
EOF
}

if [[ -z "${RALPH_CMD:-}" ]]; then
  echo "[ralph] RALPH_CMD not configured; trying local codex planner default."
  if command -v codex >/dev/null 2>&1; then
    PROMPT="$(default_plan_prompt)"
    set +e
    OUTPUT="$(codex exec "$PROMPT" 2>&1)"
    STATUS=$?
    set -e

    printf "%s\n" "$OUTPUT" > docs/agent-plan.md
    if [[ $STATUS -eq 0 ]]; then
      echo "$OUTPUT"
      exit 0
    fi
    echo "[ralph] default codex planner failed (exit $STATUS), generating fallback plan."
  fi

  {
    echo "# Ralph Plan"
    echo
    echo "## Goal"
    echo "$TASK"
    echo
    echo "## Constraints"
    echo "- Keep implementation focused and testable"
    echo "- Preserve existing app behavior"
    echo
    echo "## Step-by-step plan"
    echo "1. Inspect related files and architecture"
    echo "2. Implement smallest viable code changes"
    echo "3. Validate with lint/build/tests"
    echo
    echo "## Risks and mitigations"
    echo "- Risk: hidden regressions -> mitigate with targeted tests"
    echo
    echo "## Validation checklist"
    echo "- [ ] Lint passes"
    echo "- [ ] Build passes"
    echo "- [ ] Relevant tests pass"
  } > docs/agent-plan.md
  exit 0
fi

echo "[ralph] Running: $RALPH_CMD"
CMD="$RALPH_CMD"
MODE="as-is"
if [[ "$CMD" == *"{TASK}"* ]]; then
  CMD="${CMD//\{TASK\}/$TASK}"
  MODE="placeholder"
elif [[ "$CMD" == *"\$TASK"* ]]; then
  MODE="env-task"
elif [[ "$CMD" == codex* ]]; then
  MODE="as-is-codex"
else
  CMD="$CMD \"$TASK\""
  MODE="appended"
fi

# CI is non-interactive; force codex exec mode if caller configured plain codex mode.
if [[ ! -t 0 && "$CMD" == codex* && "$CMD" != codex\ exec* ]]; then
  CMD="codex exec ${CMD#codex }"
  MODE="${MODE}-forced-exec"
fi

echo "[ralph] mode: $MODE"

set +e
OUTPUT="$(eval "$CMD" 2>&1)"
STATUS=$?
set -e

printf "%s\n" "$OUTPUT" > docs/agent-plan.md
printf "%s\n" "$OUTPUT"

if [[ $STATUS -ne 0 ]]; then
  echo "[ralph] command failed (exit $STATUS). Falling back to generated plan."
  {
    echo "# Ralph Plan (Fallback)"
    echo
    echo "Task: $TASK"
    echo
    echo "RALPH_CMD failed with exit code: $STATUS"
    echo
    echo "## Suggested Plan"
    echo "- Clarify acceptance criteria"
    echo "- Implement in small, testable commits"
    echo "- Validate with lint/build/tests"
  } > docs/agent-plan.md
  exit 0
fi

if ! rg -q "^## Goal|^# Goal" docs/agent-plan.md; then
  {
    echo
    echo "## Goal"
    echo "$TASK"
  } >> docs/agent-plan.md
fi

if ! rg -q "Validation checklist|Validation" docs/agent-plan.md; then
  {
    echo
    echo "## Validation checklist"
    echo "- [ ] Lint/build/tests"
  } >> docs/agent-plan.md
fi

exit 0
