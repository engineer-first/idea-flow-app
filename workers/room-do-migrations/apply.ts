// RoomDO 内蔵 SQLite へマイグレーションを適用する処理そのもの。
// マイグレーション定義の集約は ./index.ts（*.sql から自動生成、詳細は
// scripts/generate-room-do-migrations.mjs）が担い、ここでは「確定済みの
// SQL 配列を DurableObjectStorage に原子的に適用する」ことだけを扱う。
//
// D1 の migrations/ と違い、DO はルームごとに独立したストレージを持ち、
// 起床タイミングもバラバラなので、「どの版まで適用済みか」を各 DO 自身が
// schema_version テーブルに記録し、起動時に不足分だけを適用して収束させる。
// バッチ全体は transactionSync で原子化する。途中で失敗した場合、部分適用
// も版更新も残らない。

export function migrateRoomStorage(
  storage: DurableObjectStorage,
  migrations: readonly string[],
): void {
  storage.transactionSync(() => {
    storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)",
    );
    const rows = storage.sql
      .exec("SELECT version FROM schema_version")
      .toArray();
    const current = rows.length > 0 ? Number(rows[0]?.version) : 0;

    if (current > migrations.length) {
      // ロールバックされた古いコードが未来のスキーマを黙って触って壊すより、
      // 明示的に落とす（api-worker の secret 検証と同じ fail-closed の方針）。
      throw new Error(
        `RoomDO のスキーマ版 v${current} はこのコードが知る v${migrations.length} より新しい`,
      );
    }

    for (const sql of migrations.slice(current)) {
      storage.sql.exec(sql);
    }

    storage.sql.exec("DELETE FROM schema_version");
    storage.sql.exec(
      "INSERT INTO schema_version (version) VALUES (?1)",
      migrations.length,
    );
  });
}
