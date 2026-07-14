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

case "$FILE" in
  */node_modules/*|*/.next/*|*/coverage/*|*/public/*|*/package-lock.json|*/AGENTS.md)
    exit 0
    ;;
esac

case "$FILE" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.css|*.scss)
    cd "$PROJECT_DIR" || exit 0
    npx --no-install biome check --write "$FILE" >&2 || true
    ;;
  *.md|*.mdx)
    cd "$PROJECT_DIR" || exit 0
    # remark-cli の `-o/--output [path]` は値を取れるオプションのため、
    # `--output "$FILE"` の順だと $FILE が「出力先」として解釈され、
    # 入力なし(空のstdin)の結果でファイルが空上書きされる。
    # 先にファイルをpositional引数で渡し、`--output` は値なしのフラグにする。
    npx --no-install remark "$FILE" --quiet --frail --output >&2 || true
    ;;
esac

exit 0
