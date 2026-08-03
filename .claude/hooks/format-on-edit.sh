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

# 拡張子ごとの振り分け・除外パス判定は scripts/format-file.sh に一本化されている
# (opencode・Codex CLI とも共有する)。ここでは Claude Code 固有の stdin JSON
# 解析だけを行い、実際の整形はそちらに委譲する。
bash "$PROJECT_DIR/scripts/format-file.sh" "$FILE" >&2 || true
exit 0
