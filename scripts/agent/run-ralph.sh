#!/usr/bin/env bash
set -euo pipefail

TASK="${1:-}"
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
# shellcheck disable=SC2086
$RALPH_CMD "$TASK" > docs/agent-plan.md
