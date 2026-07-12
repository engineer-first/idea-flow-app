-- v6: メンバーのランダム色割り当て、および付箋の個別色保持対応。
ALTER TABLE members ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow';
ALTER TABLE notes ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow';
