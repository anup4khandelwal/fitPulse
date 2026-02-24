#!/usr/bin/env bash
set -euo pipefail

TASK="${1:-}"
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
if [[ "$CMD" == codex\ exec* ]]; then
  CMD="${CMD/codex exec/codex}"
fi
if [[ "$CMD" == *"{TASK}"* ]]; then
  CMD="${CMD//\{TASK\}/$TASK}"
else
  CMD="$CMD \"$TASK\""
fi

set +e
OUTPUT="$(eval "$CMD" 2>&1)"
STATUS=$?
set -e

printf "%s\n" "$OUTPUT" > docs/codex-summary.md
printf "%s\n" "$OUTPUT"
exit "$STATUS"
