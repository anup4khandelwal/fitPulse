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

OPENAI_API_KEY="$(printf "%s" "${OPENAI_API_KEY:-}" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "[codex] OPENAI_API_KEY is empty in this process."
  exit 1
fi

export OPENAI_API_KEY
export OPENAI_API_TOKEN="${OPENAI_API_KEY}"

if [[ "${OPENAI_API_KEY:0:3}" != "sk-" ]]; then
  echo "[codex] OPENAI_API_KEY format looks invalid (expected prefix sk-)."
  exit 1
fi

KEY_PREFIX="${OPENAI_API_KEY:0:7}"
KEY_LEN="${#OPENAI_API_KEY}"
echo "[codex] key prefix: ${KEY_PREFIX}***"
echo "[codex] key length: ${KEY_LEN}"
if [[ "$KEY_LEN" -lt 20 ]]; then
  echo "[codex] OPENAI_API_KEY length is too short."
  exit 1
fi

set +e
OUTPUT="$(eval "$CMD" 2>&1)"
STATUS=$?
set -e

printf "%s\n" "$OUTPUT" > docs/codex-summary.md
printf "%s\n" "$OUTPUT"

if [[ $STATUS -ne 0 ]]; then
  if printf "%s" "$OUTPUT" | rg -qi "quota exceeded|insufficient_quota|billing|rate limit|401 unauthorized|missing bearer"; then
    {
      echo "# Codex Execution Summary (Fallback)"
      echo
      echo "Task: $TASK"
      echo
      echo "Codex command failed with recoverable platform/auth issue."
      echo
      echo "## Detected Error"
      printf "%s\n" "$OUTPUT" | sed -n '1,80p'
      echo
      echo "## Fallback Action"
      echo "- Marked as plan-only run."
      echo "- Keep workflow green so PR can still capture planning artifacts."
      echo "- Re-run after OpenAI billing/quota/auth issue is fixed."
    } > docs/codex-summary.md
    echo "[codex] Recoverable platform/auth issue detected; continuing with fallback summary."
    exit 0
  fi
fi

exit "$STATUS"
