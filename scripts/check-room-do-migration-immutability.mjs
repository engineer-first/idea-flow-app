#!/usr/bin/env node
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
    "適用済みになり得る RoomDO migration は変更・削除・名前変更できません。修正は新しい .sql migration として追加してください:",
  );
  for (const line of forbidden) console.error(`  ${line}`);
  process.exit(1);
}

console.log("OK: existing RoomDO migrations are unchanged.");
