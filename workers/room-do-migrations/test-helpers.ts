// RoomDO マイグレーションのテスト専用ヘルパー。
// テーブル名一覧・schema_version の読み取り・全テーブル削除は、マイグレー
// ション実装の内部詳細（除外すべきテーブル名パターンなど）に強く結合して
// いるため、プロジェクト全体の共有ヘルパー（workers/test-helpers.ts）では
// なくここに閉じ込める。

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

export function schemaVersion(storage: DurableObjectStorage): number {
  const rows = storage.sql.exec("SELECT version FROM schema_version").toArray();
  if (rows.length !== 1) {
    throw new Error(`schema_version は1行のはずが ${rows.length} 行`);
  }
  return Number(rows[0]?.version);
}

// テスト前提を作るためにストレージを空にする（constructor が適用済みの
// マイグレーションを含めてすべて破棄する）。
export function dropAllTables(storage: DurableObjectStorage): void {
  for (const name of tableNames(storage)) {
    storage.sql.exec(`DROP TABLE IF EXISTS "${name}"`);
  }
  storage.sql.exec("DROP TABLE IF EXISTS schema_version");
}
