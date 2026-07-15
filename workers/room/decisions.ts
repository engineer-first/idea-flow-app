// フェーズごとのホスト確定の永続状態。決定はフェーズ番号をキーにし、
// 課題・HMW・アイデアなど個別ドメインの名称を持ち込まない。
import type { Decision as ProtocolDecision } from "../../contracts/room-protocol";

export type Decision = ProtocolDecision;

type DecisionRow = {
  phase: number;
  note_id: string;
  decided_by: string;
};

export function getDecision(sql: SqlStorage, phase: number): Decision | null {
  const row = sql
    .exec(
      `SELECT phase, note_id, decided_by
       FROM decisions
       WHERE phase = ?1`,
      phase,
    )
    .toArray()[0] as DecisionRow | undefined;

  if (!row) return null;
  return {
    phase: row.phase,
    noteId: row.note_id,
    decidedBy: row.decided_by,
  };
}

export function setDecision(
  sql: SqlStorage,
  phase: number,
  noteId: string,
  decidedBy: string,
): void {
  sql.exec(
    `INSERT OR REPLACE INTO decisions (phase, note_id, decided_by, decided_at)
     VALUES (?1, ?2, ?3, ?4)`,
    phase,
    noteId,
    decidedBy,
    new Date().toISOString(),
  );
}
