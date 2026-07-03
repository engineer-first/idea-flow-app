#!/usr/bin/env bash
set -uo pipefail

PAYLOAD=$(cat)
STOP_HOOK_ACTIVE=$(jq -r '.stop_hook_active // false' <<<"$PAYLOAD")

# Stop フック起因の継続中に再実行すると無限ループになるためスキップする
[[ "$STOP_HOOK_ACTIVE" == "true" ]] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

CHANGED_TS=$(git status --porcelain -- '*.ts' '*.tsx' 2>/dev/null || true)
[[ -z "$CHANGED_TS" ]] && exit 0

VERIFY_CMD="${STOP_VERIFY_CMD:-npm run typecheck && npm run test}"

if ! OUTPUT=$(bash -c "$VERIFY_CMD" 2>&1); then
  printf '%s\n' "$OUTPUT" | tail -n 60 >&2
  echo "Typecheck or tests failed. Fix the failures before finishing." >&2
  exit 2
fi

exit 0
