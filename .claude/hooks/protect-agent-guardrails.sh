#!/usr/bin/env bash
set -euo pipefail

PAYLOAD=$(cat)
FILE=$(node -e '
  const fs = require("node:fs");
  try {
    console.log(JSON.parse(fs.readFileSync(0, "utf8")).tool_input?.file_path ?? "");
  } catch {}
' <<<"$PAYLOAD")

[[ -z "$FILE" ]] && exit 0

BASENAME=$(basename "$FILE")
NEW_TEXT=$(node -e '
  const fs = require("node:fs");
  try {
    const input = JSON.parse(fs.readFileSync(0, "utf8")).tool_input ?? {};
    console.log([input.content, input.new_string, ...(input.edits ?? []).map((edit) => edit?.new_string)].filter((value) => typeof value === "string").join("\n"));
  } catch {}
' <<<"$PAYLOAD")
OLD_TEXT=$(node -e '
  const fs = require("node:fs");
  try {
    const input = JSON.parse(fs.readFileSync(0, "utf8")).tool_input ?? {};
    console.log([input.old_string, ...(input.edits ?? []).map((edit) => edit?.old_string)].filter((value) => typeof value === "string").join("\n"));
  } catch {}
' <<<"$PAYLOAD")
HAS_FULL_CONTENT=$(node -e '
  const fs = require("node:fs");
  try {
    console.log(typeof (JSON.parse(fs.readFileSync(0, "utf8")).tool_input?.content) === "string");
  } catch {
    console.log(false);
  }
' <<<"$PAYLOAD")

deny() {
  cat >&2 <<EOF
$1
EOF
  exit 2
}

contains_script() {
  local script_name="$1"
  grep -Eq "\"${script_name}\"[[:space:]]*:" <<<"$NEW_TEXT"
}

script_is_empty() {
  local script_name="$1"
  grep -Eq "\"${script_name}\"[[:space:]]*:[[:space:]]*\"[[:space:]]*\"" <<<"$NEW_TEXT"
}

script_was_removed() {
  local script_name="$1"
  grep -Eq "\"${script_name}\"[[:space:]]*:" <<<"$OLD_TEXT" &&
    ! grep -Eq "\"${script_name}\"[[:space:]]*:" <<<"$NEW_TEXT"
}

if [[ "$BASENAME" == "CLAUDE.md" ]]; then
  deny "Refusing to edit CLAUDE.md directly. Edit AGENTS.md and keep CLAUDE.md as a symlink to AGENTS.md."
fi

if [[ "$BASENAME" == ".env" || "$BASENAME" == .env.* ]] && [[ "$BASENAME" != ".env.example" ]]; then
  deny "Refusing to edit ${BASENAME}. Secret files must be edited by a human. Update .env.example for template changes."
fi

if [[ "$BASENAME" == tsconfig*.json ]]; then
  if grep -Eq '"strict"[[:space:]]*:[[:space:]]*false' <<<"$NEW_TEXT"; then
    deny "Refusing to disable TypeScript strict mode."
  fi

  if grep -Eq '"strict"[[:space:]]*:[[:space:]]*true' <<<"$OLD_TEXT" &&
    ! grep -Eq '"strict"[[:space:]]*:' <<<"$NEW_TEXT"; then
    deny "Refusing to remove TypeScript strict mode."
  fi

  if [[ "$HAS_FULL_CONTENT" == "true" ]] &&
    ! grep -Eq '"strict"[[:space:]]*:[[:space:]]*true' <<<"$NEW_TEXT"; then
    deny "Refusing to write a tsconfig without TypeScript strict mode."
  fi
fi

if [[ "$BASENAME" == "biome.json" ]]; then
  if grep -Eq '"enabled"[[:space:]]*:[[:space:]]*false' <<<"$NEW_TEXT"; then
    deny "Refusing to disable Biome formatter or linter."
  fi
fi

if [[ "$BASENAME" == "package.json" ]]; then
  for script_name in lint typecheck test; do
    if script_is_empty "$script_name"; then
      deny "Refusing to empty the package.json ${script_name} script."
    fi

    if script_was_removed "$script_name"; then
      deny "Refusing to remove the package.json ${script_name} script."
    fi

    if [[ "$HAS_FULL_CONTENT" == "true" ]] && ! contains_script "$script_name"; then
      deny "Refusing to write package.json without the ${script_name} script."
    fi
  done
fi

exit 0
