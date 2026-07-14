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
    npx --no-install remark --quiet --frail --output "$FILE" >&2 || true
    ;;
esac

exit 0
