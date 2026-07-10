// RoomDO 内蔵 SQLite のマイグレーション版管理。
// D1 の migrations/ と違い、DO はルームごとに独立したストレージを持ち、
// 起床タイミングもバラバラなので、「どの版まで適用済みか」を各 DO 自身が
// schema_version テーブルに記録し、起動時に不足分だけを適用して収束させる。
//
// 運用ルール:
// - 配列は追記のみ。適用済みの要素（過去のインデックス）は変更しない。
// - 各要素は「バージョン N → N+1」の移行 SQL（複文可）。
// - バッチ全体を transactionSync で原子化する。途中で失敗した場合、
//   部分適用も版更新も残らない。

export const ROOM_DO_MIGRATIONS: readonly string[] = [
  // v1: 初期スキーマ。版管理導入以前の DO（テーブルはあるが版記録がない）を
  // 吸収するため IF NOT EXISTS を維持する。旧 meta テーブルは招待コードの
  // 複製（ベアラートークン相当の秘密）を残さないよう掃除する。
  `CREATE TABLE IF NOT EXISTS members (
     user_id TEXT PRIMARY KEY,
     joined_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE IF NOT EXISTS notes (
     id TEXT PRIMARY KEY,
     author_id TEXT NOT NULL,
     content TEXT NOT NULL DEFAULT '',
     x REAL NOT NULL,
     y REAL NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   DROP TABLE IF EXISTS meta;`,

  // v2: 課題ドット投票 + フェーズ管理追加 + グループ名管理テーブルの追加
  `
  CREATE TABLE IF NOT EXISTS group_names (
     representative_note_id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS note_votes (
     note_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('subjective', 'objective')),
     created_at TEXT NOT NULL,
     PRIMARY KEY (note_id, user_id, kind)
   );

   CREATE INDEX IF NOT EXISTS idx_note_votes_note_kind
     ON note_votes (note_id, kind);

   CREATE INDEX IF NOT EXISTS idx_note_votes_user_kind
     ON note_votes (user_id, kind);

   CREATE TABLE IF NOT EXISTS room_state (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     phase TEXT NOT NULL DEFAULT 'phase1'
   );

   INSERT OR IGNORE INTO room_state (id, phase)
   VALUES (1, 'phase1');
  `,

  // v3: 客観ドット複数票対応 + host管理 + グループ指向自動グループ化対応（groupsテーブル追加と旧テーブル削除）
  `
  DROP TABLE IF EXISTS group_names;
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note_ids TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  ALTER TABLE note_votes ADD COLUMN vote_count INTEGER NOT NULL DEFAULT 1;

  CREATE INDEX IF NOT EXISTS idx_note_votes_user_note_kind
    ON note_votes (user_id, note_id, kind);

  CREATE TABLE IF NOT EXISTS room_owner (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    host_id TEXT
  );

  INSERT OR IGNORE INTO room_owner (id)
  VALUES (1);
  `,
];

export function migrateRoomStorage(
  storage: DurableObjectStorage,
  migrations: readonly string[] = ROOM_DO_MIGRATIONS,
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
