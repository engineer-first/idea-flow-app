// RoomDO 内蔵 SQLite のマイグレーション版管理。
// 運用ルール: 配列は追記のみ。適用済みインデックスは変更しない。

export const ROOM_DO_MIGRATIONS: readonly string[] = [
  // v1: 初期スキーマ
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

  // v2: ドット投票 + フェーズ管理 + グループ名管理テーブルの追加
  `CREATE TABLE IF NOT EXISTS group_names (
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
   VALUES (1, 'phase1');`,

  // v3: 客観ドット複数票対応 + host管理 + グループ指向自動グループ化対応（groupsテーブル追加と旧テーブル削除）
  `DROP TABLE IF EXISTS group_names;
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
   VALUES (1);`,

  // v4: メンバー表示名（ロビー UI）
  `ALTER TABLE members ADD COLUMN name TEXT NOT NULL DEFAULT '';`,

  // v5: 個人ツールバー用の非公開付箋。既存の付箋は共有済みとして維持する。
  `ALTER TABLE notes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'shared'
     CHECK (visibility IN ('private', 'shared'));`,

  // v6: メンバーのランダム色割り当て、および付箋の個別色保持対応
  `ALTER TABLE members ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow';
   ALTER TABLE notes ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow';`,

  // v7: 退出後も色を保持し、付箋の作者色を通算で一意にする。
  `CREATE TABLE member_color_assignments (
     user_id TEXT PRIMARY KEY,
     color TEXT NOT NULL UNIQUE,
     assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   INSERT OR IGNORE INTO member_color_assignments (user_id, color)
   SELECT user_id, color FROM members;`,
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
