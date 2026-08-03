#!/usr/bin/env bash
set -uo pipefail

PAYLOAD=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FILE=$(node -e '
  let payload = "";
  process.stdin.on("data", (chunk) => (payload += chunk));
  process.stdin.on("end", () => {
    try {
      const file = JSON.parse(payload).tool_input?.file_path;
      if (typeof file === "string") process.stdout.write(file);
    } catch {}
  });
' <<<"$PAYLOAD")

[[ -z "$FILE" ]] && exit 0

case "$FILE" in
  "$PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac

REL="${FILE#"$PROJECT_DIR"/}"

# workers/room-do-migrations/*.sql の追加・変更のたびに index.ts（gitignore
# 済みの生成物）を自動再生成し、ローカルの型検査・テストを常に最新に保つ。
# ファイル名規約違反や空SQLはここで即エラーにしてエージェントへ返す。
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
