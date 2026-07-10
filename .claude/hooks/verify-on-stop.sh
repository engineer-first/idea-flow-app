#!/usr/bin/env bash
set -uo pipefail

PAYLOAD=$(cat)
STOP_HOOK_ACTIVE=$(node -e '
  const fs = require("node:fs");
  try {
    console.log(JSON.parse(fs.readFileSync(0, "utf8")).stop_hook_active ?? false);
  } catch {
    console.log(false);
  }
' <<<"$PAYLOAD")

# Stop フック起因の継続中に再実行すると無限ループになるためスキップする
[[ "$STOP_HOOK_ACTIVE" == "true" ]] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

CHANGED_TS=$(git status --porcelain -- '*.ts' '*.tsx' 2>/dev/null || true)
[[ -z "$CHANGED_TS" ]] && exit 0

VERIFY_CMD="${STOP_VERIFY_CMD:-npm run typecheck && npm run test}"

# workers/ と contracts/ の変更は workerd 上（DO・D1・WS）でしか検証できないため
# test:workers を追加する。それ以外の変更では遅い workerd 起動を避ける。
CHANGED_WORKERS=$(git status --porcelain -- 'workers/' 'contracts/' 2>/dev/null || true)
if [[ -n "$CHANGED_WORKERS" ]]; then
  VERIFY_CMD="$VERIFY_CMD && ${STOP_VERIFY_WORKERS_CMD:-npm run test:workers}"
fi

if ! OUTPUT=$(bash -c "$VERIFY_CMD" 2>&1); then
  printf '%s\n' "$OUTPUT" | tail -n 60 >&2
  echo "Typecheck or tests failed. Fix the failures before finishing." >&2
  exit 2
fi

exit 0
