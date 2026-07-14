#!/usr/bin/env bash
# 1ファイルを拡張子に応じて Biome / remark で整形する共有実装。
# Claude Code (.claude/hooks/format-on-edit.sh)・opencode (opencode.json)・
# Codex (.codex/hooks.json 経由の scripts/format-changed-files.sh) の
# 3箇所から共通で呼び出す。整形ルールをここ1箇所に集約し、ツール間のドリフトを防ぐ。
set -uo pipefail

FILE="${1:?usage: format-file.sh <path>}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR" || exit 0

case "$FILE" in
  "$PROJECT_DIR"/*) ;;
  /*) exit 0 ;;
  *) FILE="$PROJECT_DIR/$FILE" ;;
esac

case "$FILE" in
  */node_modules/*|*/.next/*|*/coverage/*|*/public/*|*/package-lock.json|*/AGENTS.md)
    exit 0
    ;;
esac

case "$FILE" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.css|*.scss)
    npx --no-install biome check --write "$FILE"
    ;;
  *.md|*.mdx)
    # remark-cli の `-o/--output [path]` は値を取れるオプションなので、
    # `--output "$FILE"` の順で書くと $FILE が出力先の値として食われ、
    # 入力は空の stdin になり、ファイルが空に上書きされてしまう
    # (実機で再現・確認済みの不具合)。$FILE を先に positional 引数として渡し、
    # 末尾の --output を値なしの真偽フラグにすることで in-place 整形になる。
    npx --no-install remark "$FILE" --quiet --frail --output
    ;;
esac
