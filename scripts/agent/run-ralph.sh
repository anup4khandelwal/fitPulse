#!/usr/bin/env bash
set -euo pipefail

TASK_RAW="${1:-}"
TASK="${TASK_RAW#"${TASK_RAW%%[![:space:]]*}"}"
TASK="${TASK%"${TASK##*[![:space:]]}"}"
if [[ -z "$TASK" ]]; then
  echo "Usage: run-ralph.sh \"<task>\""
  exit 1
fi

if [[ -z "${RALPH_CMD:-}" ]]; then
  echo "[ralph] RALPH_CMD not configured; generating fallback plan."
  {
    echo "# Ralph Plan"
    echo
    echo "Task: $TASK"
    echo
    echo "- Clarify acceptance criteria"
    echo "- Propose implementation steps"
    echo "- Identify risks and tests"
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

exit 0
