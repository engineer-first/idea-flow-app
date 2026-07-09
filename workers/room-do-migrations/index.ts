// このファイルは generate-room-do-migrations.mjs による自動生成です。
// 手で編集しないでください。変更するときは workers/room-do-migrations/ に
// *.sql を追加・削除してから、以下を実行してください。
//
//   npm run gen:room-do-migrations
//
// CI は `npm run gen:room-do-migrations:check` でこのファイルが最新か検証
// します（生成し忘れ・手編集によるズレを検出するため）。
//
// RoomDO 内蔵 SQLite のマイグレーション定義を集約する。D1 の migrations/ と
// 違い、DO はルームごとに独立したストレージを持ち起床タイミングもバラバラ
// なので、「どの版まで適用済みか」を各 DO 自身が schema_version テーブルに
// 記録し、起動時に不足分だけを適用して収束させる（適用の実装は ./apply.ts。
// この仕組み自体は変更しない）。
//
// 新しいマイグレーションを追加する手順:
// 1. workers/room-do-migrations/ に YYYYMMDDHHmmss-短い説明.sql を作る
//    （タイムスタンプなので、複数人が同時に追加しても衝突しにくい）。
// 2. `npm run gen:room-do-migrations` を実行し、このファイルを再生成する。
// 3. 生成された差分ごとコミットする。
//
// 2人が同時に同じ秒でファイルを作ってしまった場合は、このスクリプトが
// timestamp の重複としてエラーを出す。解消は片方のファイル名の秒を
// ずらすだけでよい。

export const ROOM_DO_MIGRATIONS: readonly string[] = [
  // 20260708092459-initial-schema.sql
  `-- v1: 初期スキーマ。版管理導入以前の DO（テーブルはあるが版記録がない）を
-- 吸収するため IF NOT EXISTS を維持する。旧 meta テーブルは招待コードの
-- 複製（ベアラートークン相当の秘密）を残さないよう掃除する。
CREATE TABLE IF NOT EXISTS members (
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

  // 20260709094433-votes-phase-group-names.sql
  `-- v2: ドット投票 + フェーズ管理 + グループ名管理テーブルの追加。
-- 1ユーザーは同じ付箋・同じ種別に1票だけ持てる。種別ごとの総投票数上限は
-- RoomDO の操作処理で enforcing する。
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
VALUES (1, 'phase1');`,

  // 20260709094434-vote-count-groups-host.sql
  `-- v3: 客観ドットは同じ付箋に複数票を積める（既存行は1票として保持する）。
-- あわせて host 管理（room_owner）と、グループ指向の自動グループ化対応
-- （groups テーブル追加・旧 group_names テーブル削除）を行う。
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
VALUES (1);`,

  // 20260710134136-member-name.sql
  `-- v4: メンバー表示名（ロビー UI）。
ALTER TABLE members ADD COLUMN name TEXT NOT NULL DEFAULT '';`,

  // 20260711011916-note-visibility.sql
  `-- v5: 個人ツールバー用の非公開付箋。既存の付箋は共有済みとして維持する。
ALTER TABLE notes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'shared'
  CHECK (visibility IN ('private', 'shared'));`,

  // 20260712113052-member-note-colors.sql
  `-- v6: メンバーのランダム色割り当て、および付箋の個別色保持対応。
ALTER TABLE members ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow';
ALTER TABLE notes ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow';`,

  // 20260712113053-member-color-assignments.sql
  `-- v7: 退出後も色を保持し、付箋の作者色を通算で一意にする。
CREATE TABLE member_color_assignments (
  user_id TEXT PRIMARY KEY,
  color TEXT NOT NULL UNIQUE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO member_color_assignments (user_id, color)
SELECT user_id, color FROM members;`,
];

export { migrateRoomStorage } from "./apply";
