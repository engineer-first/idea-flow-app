-- TODO: このマイグレーションの意図と SQL を書く。
-- ルーム共有タイマーの権威状態。1 RoomDO につき常に1行だけを持つ。
CREATE TABLE timer_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'paused')),
  ends_at INTEGER,
  remaining_ms INTEGER,
  duration_ms INTEGER,
  CHECK (
    (status = 'idle' AND ends_at IS NULL AND remaining_ms IS NULL AND duration_ms IS NULL)
    OR (status = 'running' AND ends_at IS NOT NULL AND remaining_ms IS NULL AND duration_ms IS NOT NULL)
    OR (status = 'paused' AND ends_at IS NULL AND remaining_ms IS NOT NULL AND duration_ms IS NOT NULL)
  )
);
INSERT INTO timer_state (id, status) VALUES (1, 'idle');
