#!/usr/bin/env bash
set -uo pipefail

PAYLOAD=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FILE=$(jq -r '.tool_input.file_path // empty' <<<"$PAYLOAD")

[[ -z "$FILE" ]] && exit 0

case "$FILE" in
  "$PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac

REL="${FILE#"$PROJECT_DIR"/}"

# workers/room-do-migrations/*.sql の追加・変更のたびに index.ts を自動再生成
# する。複数人が並行でマイグレーションを追加しても npm run gen:room-do-migrations
# を手で打つ必要がなくなる（CI は gen:room-do-migrations:check で最終確認する）。
case "$REL" in
  workers/room-do-migrations/*.sql) ;;
  *) exit 0 ;;
esac

cd "$PROJECT_DIR" || exit 0

if ! OUTPUT=$(node scripts/generate-room-do-migrations.mjs 2>&1); then
  printf '%s\n' "$OUTPUT" >&2
  exit 2
fi

exit 0
