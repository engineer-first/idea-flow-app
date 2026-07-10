// D1（lobby）のスキーマを workers/migrations/*.sql から一時sqliteファイルへ再構築する。
// tbls はDBに接続してドキュメントを生成するため、生SQL migrations を
// 素のsqliteファイルとして再現し、そこへ接続させる。

import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "workers/migrations");
const OUT_PATH = join(ROOT, "tmp/d1-schema.sqlite");

mkdirSync(join(ROOT, "tmp"), { recursive: true });
rmSync(OUT_PATH, { force: true });

const files = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const db = new DatabaseSync(OUT_PATH);
for (const file of files) {
  db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
}
db.close();

console.log(
  `D1 schema written to ${OUT_PATH} (${files.length} migration(s) applied)`,
);
