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

# 境界ルールの対象は UI・共有層のみ。workers/ 自身は対象外。
case "$REL" in
  app/*|lib/*|components/*|contracts/*) ;;
  *) exit 0 ;;
esac

case "$REL" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# ast-grep 未導入の環境（npm install 前など）ではチェックせずに通す
AST_GREP="$PROJECT_DIR/node_modules/.bin/ast-grep"
[[ -x "$AST_GREP" ]] || exit 0

cd "$PROJECT_DIR" || exit 0

if ! OUTPUT=$("$AST_GREP" scan "$REL" 2>&1); then
  printf '%s\n' "$OUTPUT" >&2
  echo "Boundary violation. Reach D1/RoomDO only through api-worker; import shared shapes from contracts/." >&2
  exit 2
fi

exit 0
