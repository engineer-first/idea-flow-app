-- v5: 個人ツールバー用の非公開付箋。既存の付箋は共有済みとして維持する。
ALTER TABLE notes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'shared'
  CHECK (visibility IN ('private', 'shared'));
