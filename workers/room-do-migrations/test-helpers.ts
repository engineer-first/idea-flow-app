// RoomDO マイグレーションのテスト専用ヘルパー。
// テーブル名一覧・適用済みIDの読み取り・全テーブル削除は、マイグレーション
// 実装の内部詳細（除外すべきテーブル名パターンなど）に強く結合しているため、
// プロジェクト全体の共有ヘルパー（workers/test-helpers.ts）ではなくここに
// 閉じ込める。

// sqlite 内部テーブルと DO ランタイムの内部テーブル（_cf_KV）を除いた
// ユーザーテーブル名の一覧。
export function tableNames(storage: DurableObjectStorage): string[] {
  return storage.sql
    .exec(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       ORDER BY name`,
    )
    .toArray()
    .map((row) => String(row.name));
}

// schema_migrations に記録された適用済みマイグレーションIDを昇順で返す。
export function appliedMigrationIds(storage: DurableObjectStorage): string[] {
  return storage.sql
    .exec("SELECT id FROM schema_migrations ORDER BY id")
    .toArray()
    .map((row) => String(row.id));
}

// テスト前提を作るためにストレージを空にする（constructor が適用済みの
// マイグレーションと適用記録を含めてすべて破棄する）。
export function dropAllTables(storage: DurableObjectStorage): void {
  for (const name of tableNames(storage)) {
    const quotedName = name.replace(/"/g, '""');
    storage.sql.exec(`DROP TABLE IF EXISTS "${quotedName}"`);
  }
}
