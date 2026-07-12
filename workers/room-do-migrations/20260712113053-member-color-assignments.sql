-- v7: 退出後も色を保持し、付箋の作者色を通算で一意にする。
CREATE TABLE member_color_assignments (
  user_id TEXT PRIMARY KEY,
  color TEXT NOT NULL UNIQUE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO member_color_assignments (user_id, color)
SELECT user_id, color FROM members;
