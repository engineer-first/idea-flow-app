// RoomDO（SQLite-backed Durable Object）のスキーマを
// workers/room-do-migrations.ts の ROOM_DO_MIGRATIONS から一時sqliteファイルへ再構築する。
// D1 とは物理的に別のストレージであり、DBレベルの結合は存在しない。
// そのためドキュメントも D1 とは別に生成し、両者の責任分界を図の上でも保つ。

import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { ROOM_DO_MIGRATIONS } from "../workers/room-do-migrations.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "tmp/room-do-schema.sqlite");

mkdirSync(join(ROOT, "tmp"), { recursive: true });
rmSync(OUT_PATH, { force: true });

const db = new DatabaseSync(OUT_PATH);
for (const sql of ROOM_DO_MIGRATIONS) {
  db.exec(sql);
}
db.close();

console.log(
  `RoomDO schema written to ${OUT_PATH} (${ROOM_DO_MIGRATIONS.length} migration(s) applied)`,
);
