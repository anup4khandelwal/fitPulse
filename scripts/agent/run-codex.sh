#!/usr/bin/env bash
set -euo pipefail

TASK_RAW="${1:-}"
TASK="${TASK_RAW#"${TASK_RAW%%[![:space:]]*}"}"
TASK="${TASK%"${TASK##*[![:space:]]}"}"
if [[ -z "$TASK" ]]; then
  echo "Usage: run-codex.sh \"<task>\""
  exit 1
fi

if [[ -z "${CODEX_CMD:-}" ]]; then
  echo "[codex] CODEX_CMD not configured; writing summary only."
  {
    echo "# Codex Execution Summary"
    echo
    echo "Task: $TASK"
    echo
    echo "- No CODEX_CMD configured in environment."
    echo "- Configure CODEX_CMD to execute real automation."
  } > docs/codex-summary.md
  exit 0
fi

echo "[codex] Running: $CODEX_CMD"
CMD="$CODEX_CMD"
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

echo "[codex] mode: $MODE"
echo "[codex] command prepared."

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "[codex] OPENAI_API_KEY is empty in this process."
  exit 1
fi

export OPENAI_API_KEY
export OPENAI_API_TOKEN="${OPENAI_API_KEY}"

set +e
OUTPUT="$(eval "$CMD" 2>&1)"
STATUS=$?
set -e

printf "%s\n" "$OUTPUT" > docs/codex-summary.md
printf "%s\n" "$OUTPUT"
exit "$STATUS"
