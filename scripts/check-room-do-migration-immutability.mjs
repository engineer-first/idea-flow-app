#!/usr/bin/env node
// develop にマージ済みの RoomDO migration（.sql）が変更・削除・リネーム
// されていないかを、比較元（PR の base）との diff で検査する。
// schema_migrations は ID しか記録しないため、適用済み ID の内容が変わっても
// 再実行されず、DO 間でスキーマが黙って分岐する。テストは常に新規 DO で走る
// のでこの分岐はテストに現れず、レビュアーの目視にも頼れないため CI で塞ぐ。
// 三点ドット（base...HEAD）は merge-base 比較なので、ブランチ内で追加した
// 未マージの .sql の編集は「追加」のまま扱われ、検出対象にならない。
import { spawnSync } from "node:child_process";

const base = process.argv[2];
if (!base) {
  console.error("比較元のGit refを指定してください（例: origin/develop）。");
  process.exit(2);
}

const result = spawnSync(
  "git",
  [
    "diff",
    "--name-status",
    "--find-renames",
    "--diff-filter=MDR",
    `${base}...HEAD`,
    "--",
    "workers/room-do-migrations",
  ],
  { encoding: "utf8" },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 2);
}

const forbidden = result.stdout
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((line) =>
    line
      .split("\t")
      .slice(1)
      .some((path) => path.endsWith(".sql")),
  );

if (forbidden.length > 0) {
  console.error(
    "マージ済みの RoomDO migration は変更・削除・名前変更できません（適用済みIDの内容が変わると DO 間でスキーマが分岐します）。修正は新しい migration として追加してください:",
  );
  for (const line of forbidden) console.error(`  ${line}`);
  process.exit(1);
}

console.log("OK: merged RoomDO migrations are unchanged.");
