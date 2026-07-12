// RoomDO 内蔵 SQLite へマイグレーションを適用する処理そのもの。
// マイグレーション定義の集約は ./index.ts（*.sql から自動生成、詳細は
// scripts/generate-room-do-migrations.mjs）が担い、ここでは「確定済みの
// マイグレーション配列を DurableObjectStorage に原子的に適用する」ことだけを扱う。
//
// D1 の migrations/ と違い、DO はルームごとに独立したストレージを持ち、
// 起床タイミングもバラバラなので、「どれを適用済みか」を各 DO 自身が
// schema_migrations テーブルに適用済みID（ファイル名のタイムスタンプ）として
// 記録し、起動時に不足分だけを適用して収束させる。
//
// 「適用済み件数」ではなくIDで追跡するのは、タイムスタンプ順ソートと件数管理の
// 組み合わせが並行開発のマージで壊れるため。古いタイムスタンプのマイグレーション
// が後からマージされると配列内の位置がずれ、件数管理では適用済みのものを
// 二重適用し、割り込んだものを取りこぼす。IDなら位置に依存しない。
// なお、その場合の適用順は既存DO（割り込み分が後）と新規DO（タイムスタンプ順）で
// 異なる。これはタイムスタンプ方式に固有のトレードオフで、各マイグレーションを
// 直前のものにだけ依存させないことで吸収する。
//
// バッチ全体は transactionSync で原子化する。途中で失敗した場合、部分適用
// も適用記録も残らない。

export type RoomDoMigration = {
  readonly id: string;
  readonly sql: string;
};

// schema_version 方式で公開済みだった配列の順序。現在の timestamp ソート済み
// 配列から導出すると、古いIDが後から割り込んだ際に旧版番号の意味が変わるため、
// ID方式への変換が完了するまで不変の対応表として保持する。
export const LEGACY_ROOM_DO_MIGRATION_IDS: readonly string[] = [
  "20260708092459",
  "20260709094433",
  "20260709094434",
  "20260710134136",
  "20260711011916",
  "20260712113052",
  "20260712113053",
];

export function migrateRoomStorage(
  storage: DurableObjectStorage,
  migrations: readonly RoomDoMigration[],
  legacyMigrationIds: readonly string[],
): void {
  storage.transactionSync(() => {
    storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         id TEXT PRIMARY KEY,
         applied_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`,
    );

    convertLegacySchemaVersion(storage, legacyMigrationIds);

    const applied = new Set(
      storage.sql
        .exec("SELECT id FROM schema_migrations")
        .toArray()
        .map((row) => String(row.id)),
    );

    const known = new Set(migrations.map((m) => m.id));
    for (const id of applied) {
      if (!known.has(id)) {
        // ロールバックされた古いコードが未来のスキーマを黙って触って壊すより、
        // 明示的に落とす（api-worker の secret 検証と同じ fail-closed の方針）。
        throw new Error(
          `RoomDO のストレージには、このコードが知らないマイグレーション ${id} が適用済み`,
        );
      }
    }

    for (const { id, sql } of migrations) {
      if (applied.has(id)) continue;
      storage.sql.exec(sql);
      storage.sql.exec("INSERT INTO schema_migrations (id) VALUES (?1)", id);
    }
  });
}

// 旧・件数方式（schema_version に適用済み件数を記録）からの片道変換。
// 件数方式の時代は単一ファイルへの追記のみだったため、「先頭N件 = 適用済み」
// の解釈がそのまま成り立つ。変換後は schema_version を撤去し、以後の追跡を
// schema_migrations に一本化する。
function convertLegacySchemaVersion(
  storage: DurableObjectStorage,
  legacyMigrationIds: readonly string[],
): void {
  const legacyTable = storage.sql
    .exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'",
    )
    .toArray();
  if (legacyTable.length === 0) return;

  const rows = storage.sql.exec("SELECT version FROM schema_version").toArray();
  if (rows.length > 1) {
    throw new Error(
      "RoomDO の旧スキーマ版 schema_version は1行である必要があります",
    );
  }
  const count = rows.length === 1 ? Number(rows[0]?.version) : 0;

  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > legacyMigrationIds.length
  ) {
    // ロールバックされた古いコードが未来のスキーマを黙って触って壊すより、
    // 明示的に落とす（同ファイルの fail-closed 方針と揃える）。
    throw new Error(
      `RoomDO の旧スキーマ版 v${count} はこのコードが知る v${legacyMigrationIds.length} より新しい`,
    );
  }

  for (const id of legacyMigrationIds.slice(0, count)) {
    storage.sql.exec(
      "INSERT OR IGNORE INTO schema_migrations (id) VALUES (?1)",
      id,
    );
  }
  storage.sql.exec("DROP TABLE schema_version");
}
