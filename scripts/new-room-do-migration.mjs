#!/usr/bin/env node
// タイムスタンプ付きの RoomDO マイグレーションファイルを作成する
// （`rails generate migration` の簡易版）。タイムスタンプを手で打つと
// 形式ミス・ローカルタイムゾーン差による順序の逆転・同じ秒の衝突が
// 起きやすいので、発番をここに一元化して UTC で採番する。
//
// 作成するのは TODO コメントだけのスタブ。index.ts（gitignore 済みの生成物）
// は SQL を書いたあと test:workers / dev:api などの実行時に自動再生成される
// （スタブのままだと generate 側の空SQLガードが「書き忘れ」として検出する）。
//
// 実行: npm run new:room-do-migration -- 短い説明（例: add-note-kind）
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MIGRATIONS_DIR } from "./generate-room-do-migrations.mjs";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const TEMPLATE = "-- TODO: このマイグレーションの意図と SQL を書く。\n";

export function formatUtcTimestamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  );
}

export function buildMigrationFileName(slug, now, existingFiles) {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `説明は英小文字・数字・ハイフンだけで指定してください（例: add-note-kind）: ${slug}`,
    );
  }
  const taken = new Set(
    existingFiles.filter((f) => f.endsWith(".sql")).map((f) => f.slice(0, 14)),
  );
  let at = now;
  while (taken.has(formatUtcTimestamp(at))) {
    at = new Date(at.getTime() + 1000);
  }
  return `${formatUtcTimestamp(at)}-${slug}.sql`;
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error(
      "使い方: npm run new:room-do-migration -- 短い説明（例: add-note-kind）",
    );
    process.exit(1);
  }

  let fileName;
  try {
    fileName = buildMigrationFileName(
      slug,
      new Date(),
      readdirSync(MIGRATIONS_DIR),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const filePath = join(MIGRATIONS_DIR, fileName);
  // wx: 万一同名ファイルがあっても上書きしない（発番の衝突回避が前提だが保険）。
  writeFileSync(filePath, TEMPLATE, { flag: "wx" });
  console.log(`Created ${filePath}`);
  console.log(
    "SQL を書いたら .sql だけをコミットしてください（index.ts は test:workers などの実行時に自動再生成される生成物です）。",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
