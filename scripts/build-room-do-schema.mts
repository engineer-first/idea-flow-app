// RoomDO（SQLite-backed Durable Object）のスキーマを
// workers/room-do-migrations/*.sql から一時sqliteファイルへ再構築する。
// 集約ファイル（index.ts）は workerd 向けの生成物なので経由せず、
// 源泉である .sql を generate-room-do-migrations.mjs と同じ規則で読む。
// D1 とは物理的に別のストレージであり、DBレベルの結合は存在しない。
// そのためドキュメントも D1 とは別に生成し、両者の責任分界を図の上でも保つ。

import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { collectMigrations } from "./generate-room-do-migrations.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "tmp/room-do-schema.sqlite");

mkdirSync(join(ROOT, "tmp"), { recursive: true });
rmSync(OUT_PATH, { force: true });

const migrations = collectMigrations({ readdirSync, readFileSync });

const db = new DatabaseSync(OUT_PATH);
for (const { sql } of migrations) {
  db.exec(sql);
}
db.close();

console.log(
  `RoomDO schema written to ${OUT_PATH} (${migrations.length} migration(s) applied)`,
);
