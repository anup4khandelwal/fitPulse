#!/usr/bin/env bash
set -euo pipefail

TASK_RAW="${1:-}"
TASK="${TASK_RAW#"${TASK_RAW%%[![:space:]]*}"}"
TASK="${TASK%"${TASK##*[![:space:]]}"}"
if [[ -z "$TASK" ]]; then
  echo "Usage: run-codex.sh \"<task>\""
  exit 1
fi

mkdir -p docs

build_default_codex_prompt() {
  local prompt_file="scripts/agent/prompts/codex-implement.txt"
  local plan_text=""
  if [[ -f docs/agent-plan.md ]]; then
    plan_text="$(cat docs/agent-plan.md)"
  fi

  if [[ -f "$prompt_file" ]]; then
    local template
    template="$(cat "$prompt_file")"
    template="${template//\{\{TASK\}\}/$TASK}"
    printf "%s" "${template//\{\{PLAN\}\}/$plan_text}"
    return 0
  fi

  cat <<EOF
Implement this task in the current repository:

$TASK

Use this plan as guidance:

$plan_text

Requirements:
- Make minimal, production-safe changes.
- Run relevant checks.
- Summarize exactly what changed.
EOF
}

if [[ -z "${CODEX_CMD:-}" ]]; then
  if command -v codex >/dev/null 2>&1; then
    CODEX_CMD='codex exec "{TASK}"'
  else
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
fi

echo "[codex] Running: $CODEX_CMD"
CMD="$CODEX_CMD"
MODE="as-is"
TASK_FOR_CODEX="$TASK"

if [[ "${USE_RALPH_PLAN_CONTEXT:-true}" == "true" ]]; then
  TASK_FOR_CODEX="$(build_default_codex_prompt)"
fi

if [[ "$CMD" == *"{TASK}"* ]]; then
  CMD="${CMD//\{TASK\}/$TASK_FOR_CODEX}"
  MODE="placeholder"
elif [[ "$CMD" == *"\$TASK"* ]]; then
  MODE="env-task"
elif [[ "$CMD" == codex* ]]; then
  MODE="as-is-codex"
else
  CMD="$CMD \"$TASK_FOR_CODEX\""
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
export TASK="$TASK_FOR_CODEX"

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
  if printf "%s" "$OUTPUT" | rg -qi "quota exceeded|insufficient_quota|billing"; then
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
    printf "quota\n" > docs/codex-fallback.status
    echo "[codex] Fallback reason: quota"
    echo "[codex] Recoverable platform/auth issue detected; continuing with fallback summary."
    exit 0
  fi

  if printf "%s" "$OUTPUT" | rg -qi "401 unauthorized|missing bearer|authentication"; then
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
      echo "- Re-run after OpenAI authentication issue is fixed."
    } > docs/codex-summary.md
    printf "auth\n" > docs/codex-fallback.status
    echo "[codex] Fallback reason: auth"
    echo "[codex] Recoverable platform/auth issue detected; continuing with fallback summary."
    exit 0
  fi
fi

exit "$STATUS"
