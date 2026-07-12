-- v4: メンバー表示名（ロビー UI）。
ALTER TABLE members ADD COLUMN name TEXT NOT NULL DEFAULT '';
