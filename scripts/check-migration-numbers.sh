#!/usr/bin/env bash
# workers/migrations/NNNN_snake_case_name.sql の連番重複を検出する。
# 複数ブランチが並行して同じ番号を採番した場合、マージ後のツリーで
# ファイル名主要部分が異なるため Git はコンフリクトしない。
# CI が PR のマージコミットをチェックアウトするため、このスクリプトを
# CI 上で実行すれば重複がマージ前に検知できる。
#
# 連想配列を使わず sort/uniq のみで判定する (macOS 標準の bash 3.2 互換のため)。
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MIGRATIONS_DIR="$PROJECT_DIR/workers/migrations"

[[ -d "$MIGRATIONS_DIR" ]] || exit 0

numbers=""
while IFS= read -r -d '' file; do
  name=$(basename "$file")
  if [[ "$name" =~ ^([0-9]{4})_ ]]; then
    numbers="${numbers}${BASH_REMATCH[1]}"$'\n'
  fi
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -print0)

duplicates=$(printf '%s' "$numbers" | sort | uniq -d)

[[ -z "$duplicates" ]] && exit 0

status=0
while IFS= read -r number; do
  [[ -z "$number" ]] && continue
  files=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "${number}_*.sql" | xargs -n1 basename | sort | tr '\n' ' ')
  echo "migration番号が重複しています: ${number} (${files})" >&2
  status=1
done <<<"$duplicates"

exit "$status"
