-- v3: 客観ドットは同じ付箋に複数票を積める（既存行は1票として保持する）。
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
VALUES (1);
