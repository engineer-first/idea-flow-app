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
  // v2: 課題ドット投票。1ユーザーは同じ付箋・同じ種別に1票だけ持てる。
  // 種別ごとの総投票数上限は RoomDO の操作処理で enforcing する。
  // （develop に先に入ったため v2/v3 は投票系を維持。#70 の phase は v4）
  `CREATE TABLE IF NOT EXISTS note_votes (
     note_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('subjective', 'objective')),
     created_at TEXT NOT NULL,
     PRIMARY KEY (note_id, user_id, kind)
   );
   CREATE INDEX IF NOT EXISTS idx_note_votes_note_kind
     ON note_votes (note_id, kind);
   CREATE INDEX IF NOT EXISTS idx_note_votes_user_kind
     ON note_votes (user_id, kind);`,
  // v3: 客観ドットは同じ付箋に複数票を積める。既存行は1票として保持する。
  `ALTER TABLE note_votes ADD COLUMN vote_count INTEGER NOT NULL DEFAULT 1;
   CREATE INDEX IF NOT EXISTS idx_note_votes_user_note_kind
     ON note_votes (user_id, note_id, kind);`,
  // v4: ルームの進行状態 (lobby / writing) とメンバー名表示を保持する（#70）。
  // - members に name を追加: メンバー一覧 UI 用。upsertMember は name を受け取り UPDATE も行う。
  // - room_state: 進行状態を 1 行で持つ。lobby がデフォルト。
  `ALTER TABLE members ADD COLUMN name TEXT NOT NULL DEFAULT '';
   CREATE TABLE IF NOT EXISTS room_state (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     phase TEXT NOT NULL DEFAULT 'lobby',
     changed_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   INSERT OR IGNORE INTO room_state (id, phase) VALUES (1, 'lobby');`,
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
