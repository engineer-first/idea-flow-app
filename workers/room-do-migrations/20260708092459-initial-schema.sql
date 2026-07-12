-- v1: 初期スキーマ。版管理導入以前の DO（テーブルはあるが版記録がない）を
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
DROP TABLE IF EXISTS meta;
