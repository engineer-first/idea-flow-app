// ドット投票（note_votes）の真実。集計クエリと投票ポリシー
// （上限・完了判定）をここに集約する。書き込みも必ずこのモジュールを通す。
import {
  DOT_VOTE_LIMITS,
  type DotVoteKind,
} from "../../contracts/room-protocol";

export function hasVote(
  sql: SqlStorage,
  noteId: string,
  userId: string,
  kind: DotVoteKind,
): boolean {
  return countUserNoteVotes(sql, noteId, userId, kind) > 0;
}

export function countUserNoteVotes(
  sql: SqlStorage,
  noteId: string,
  userId: string,
  kind: DotVoteKind,
): number {
  const rows = sql
    .exec(
      `SELECT COALESCE(SUM(vote_count), 0) AS count FROM note_votes
       WHERE note_id = ?1 AND user_id = ?2 AND kind = ?3`,
      noteId,
      userId,
      kind,
    )
    .toArray();
  return Number(rows[0]?.count ?? 0);
}

export function countUserVotes(
  sql: SqlStorage,
  userId: string,
  kind: DotVoteKind,
  phase: number,
): number {
  const rows = sql
    .exec(
      `SELECT COALESCE(SUM(v.vote_count), 0) AS count
       FROM note_votes v
       INNER JOIN notes n ON n.id = v.note_id
       WHERE v.user_id = ?1 AND v.kind = ?2 AND n.phase = ?3`,
      userId,
      kind,
      phase,
    )
    .toArray();
  return Number(rows[0]?.count ?? 0);
}

export function countNoteVotes(
  sql: SqlStorage,
  noteId: string,
  kind: DotVoteKind,
): number {
  const rows = sql
    .exec(
      "SELECT COALESCE(SUM(vote_count), 0) AS count FROM note_votes WHERE note_id = ?1 AND kind = ?2",
      noteId,
      kind,
    )
    .toArray();
  return Number(rows[0]?.count ?? 0);
}

export function hasReachedVoteLimit(
  sql: SqlStorage,
  userId: string,
  kind: DotVoteKind,
  phase: number,
): boolean {
  return countUserVotes(sql, userId, kind, phase) >= DOT_VOTE_LIMITS[kind];
}

// kind の1票を加算する（票が無ければ作成する）。上限チェックは呼び出し側が行う。
export function addUserNoteVote(
  sql: SqlStorage,
  noteId: string,
  userId: string,
  kind: DotVoteKind,
): void {
  if (countUserNoteVotes(sql, noteId, userId, kind) > 0) {
    sql.exec(
      `UPDATE note_votes
       SET vote_count = vote_count + 1
       WHERE note_id = ?1 AND user_id = ?2 AND kind = ?3`,
      noteId,
      userId,
      kind,
    );
    return;
  }
  sql.exec(
    `INSERT INTO note_votes (note_id, user_id, kind, created_at, vote_count)
     VALUES (?1, ?2, ?3, ?4, 1)`,
    noteId,
    userId,
    kind,
    new Date().toISOString(),
  );
}

// あるユーザーの kind の票をその付箋からすべて取り除く
// （主観投票のトグル解除と note:vote-reset の共用経路）。
export function removeUserNoteVotes(
  sql: SqlStorage,
  noteId: string,
  userId: string,
  kind: DotVoteKind,
): void {
  sql.exec(
    `DELETE FROM note_votes
     WHERE note_id = ?1 AND user_id = ?2 AND kind = ?3`,
    noteId,
    userId,
    kind,
  );
}

// 付箋削除時に紐づく票をすべて消す。
export function deleteNoteVotes(sql: SqlStorage, noteId: string): void {
  sql.exec("DELETE FROM note_votes WHERE note_id = ?1", noteId);
}

// 全メンバーが主観・客観とも上限まで投票し終えたか（phase3 → phase4 のゲート）。
// members との JOIN は「メンバーごとの投票数」という投票側の関心なのでここに置く。
export function haveAllMembersCompletedVoting(
  sql: SqlStorage,
  phase: number,
): boolean {
  const rows = sql
    .exec(
      `SELECT m.user_id
       FROM members m
       LEFT JOIN (
         SELECT v.user_id, v.kind, SUM(v.vote_count) AS vote_count
         FROM note_votes v
         INNER JOIN notes n ON n.id = v.note_id
         WHERE n.phase = ?1
         GROUP BY v.user_id, v.kind
       ) v ON v.user_id = m.user_id
       GROUP BY m.user_id
       HAVING COALESCE(SUM(CASE WHEN v.kind = 'subjective' THEN v.vote_count END), 0) != ?2
           OR COALESCE(SUM(CASE WHEN v.kind = 'objective' THEN v.vote_count END), 0) != ?3`,
      phase,
      DOT_VOTE_LIMITS.subjective,
      DOT_VOTE_LIMITS.objective,
    )
    .toArray();
  return rows.length === 0;
}
