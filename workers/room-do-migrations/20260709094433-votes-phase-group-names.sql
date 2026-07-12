-- v2: ドット投票 + フェーズ管理 + グループ名管理テーブルの追加。
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
VALUES (1, 'phase1');
