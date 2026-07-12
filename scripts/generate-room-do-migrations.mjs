#!/usr/bin/env node
// workers/room-do-migrations/*.sql から workers/room-do-migrations/index.ts を
// 生成する。複数人が同時にマイグレーションファイルを追加しても集約ファイル
// （index.ts）を手で編集する必要がなくなり、コンフリクトが起きない。
// ファイル名の先頭14桁（YYYYMMDDHHmmss）が適用順序を決めるIDになる。タイム
// スタンプなので複数人が同時に追加しても衝突しにくく、万一衝突したらこの
// スクリプトがエラーで検出する。
//
// 実行:
//   npm run gen:room-do-migrations         index.ts を生成して書き込む
//   npm run gen:room-do-migrations:check   生成結果と現在の index.ts の一致を確認する（CI用）
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(__dirname, "../workers/room-do-migrations");
export const OUTPUT_FILE = join(MIGRATIONS_DIR, "index.ts");

const FILE_NAME_PATTERN = /^(\d{14})-([a-z0-9-]+)\.sql$/;

export function parseMigrationFileName(fileName) {
  const match = fileName.match(FILE_NAME_PATTERN);
  if (!match) return null;
  const [, timestamp, slug] = match;
  return { timestamp, slug };
}

export function sortAndValidate(entries) {
  const sorted = [...entries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const byTimestamp = new Map();
  for (const entry of sorted) {
    const existing = byTimestamp.get(entry.timestamp);
    if (existing) {
      throw new Error(
        `RoomDO マイグレーションの timestamp が重複しています: ${entry.timestamp}（${existing.file} と ${entry.file}）`,
      );
    }
    byTimestamp.set(entry.timestamp, entry);
  }
  return sorted;
}

export function collectMigrations(
  { readdirSync: readdir, readFileSync: readFile },
  dirPath = MIGRATIONS_DIR,
) {
  const files = readdir(dirPath).filter((f) => f.endsWith(".sql"));
  const entries = files.map((file) => {
    const parsed = parseMigrationFileName(file);
    if (!parsed) {
      throw new Error(
        `マイグレーションファイル名が規約に合いません: ${file}（期待: YYYYMMDDHHmmss-短い説明.sql）`,
      );
    }
    return { ...parsed, file };
  });

  return sortAndValidate(entries).map((entry) => ({
    ...entry,
    sql: readFile(join(dirPath, entry.file), "utf8").trimEnd(),
  }));
}

function escapeForTemplateLiteral(sql) {
  return sql
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

export function renderIndexFile(migrations) {
  const header = `// このファイルは generate-room-do-migrations.mjs による自動生成です。
// 手で編集しないでください。変更するときは workers/room-do-migrations/ に
// 新しい *.sql を追加してから、以下を実行してください。既存の .sql は変更・削除しない
// でください（適用済みIDの内容が変わると、DO間でスキーマが分岐するため）。
//
//   npm run gen:room-do-migrations
//
// CI は \`npm run gen:room-do-migrations:check\` でこのファイルが最新か検証
// します（生成し忘れ・手編集によるズレを検出するため）。
//
// RoomDO 内蔵 SQLite のマイグレーション定義を集約する。D1 の migrations/ と
// 違い、DO はルームごとに独立したストレージを持ち起床タイミングもバラバラ
// なので、「どれを適用済みか」を各 DO 自身が schema_migrations テーブルに
// 適用済みID（ファイル名のタイムスタンプ）として記録し、起動時に不足分だけ
// を適用して収束させる（適用の実装は ./apply.ts。この仕組み自体は変更しない）。
//
// 新しいマイグレーションを追加する手順:
// 1. workers/room-do-migrations/ に YYYYMMDDHHmmss-短い説明.sql を作る
//    （タイムスタンプなので、複数人が同時に追加しても衝突しにくい）。
// 2. \`npm run gen:room-do-migrations\` を実行し、このファイルを再生成する。
// 3. 生成された差分ごとコミットする。
//
// 2人が同時に同じ秒でファイルを作ってしまった場合は、このスクリプトが
// timestamp の重複としてエラーを出す。解消は片方のファイル名の秒を
// ずらすだけでよい。
import type { RoomDoMigration } from "./apply";
`;

  const body = migrations
    .map(
      (m) =>
        `  // ${m.file}\n  {\n    id: "${m.timestamp}",\n    sql: \`${escapeForTemplateLiteral(m.sql)}\`,\n  },`,
    )
    .join("\n\n");

  const arrayBlock =
    migrations.length > 0
      ? `export const ROOM_DO_MIGRATIONS: readonly RoomDoMigration[] = [\n${body}\n];\n`
      : "export const ROOM_DO_MIGRATIONS: readonly RoomDoMigration[] = [];\n";

  return `${header}\n${arrayBlock}\nexport { LEGACY_ROOM_DO_MIGRATION_IDS, migrateRoomStorage } from "./apply";\n`;
}

function main() {
  const migrations = collectMigrations({ readdirSync, readFileSync });
  const output = renderIndexFile(migrations);

  if (process.argv.includes("--check")) {
    let current = null;
    try {
      current = readFileSync(OUTPUT_FILE, "utf8");
    } catch {
      // 未生成（ENOENT など）は「一致していない」として下の案内に合流させる。
    }
    if (current !== output) {
      console.error(
        "workers/room-do-migrations/index.ts が *.sql の内容と一致していません。`npm run gen:room-do-migrations` を実行してコミットしてください。",
      );
      process.exit(1);
    }
    console.log("OK: workers/room-do-migrations/index.ts is up to date.");
    return;
  }

  writeFileSync(OUTPUT_FILE, output);
  console.log(
    `Generated ${OUTPUT_FILE} from ${migrations.length} migration(s).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
