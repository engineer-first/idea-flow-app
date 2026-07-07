-- ロビー層のスキーマ。ルームの「中身」（メンバー・付箋）の真実は RoomDO が持ち、
-- D1 はルーム横断のディレクトリ（ユーザー・招待コード → ルーム解決）だけを持つ。
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  google_sub TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  host_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX rooms_host_id_idx ON rooms (host_id);
