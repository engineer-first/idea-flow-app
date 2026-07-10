import type { VoteTotalingRowViewModel } from "@/app/components/vote-totaling/molecules/vote-totaling-row";
import { VoteTotalingRow } from "@/app/components/vote-totaling/molecules/vote-totaling-row";
import type { Note } from "@/app/rooms/notes-reducer";
import type { Member } from "@/app/rooms/room-reducer";
import { DOT_VOTE_LIMITS } from "@/contracts/room-protocol";

const SUBJECTIVE_POINT = 5;
const OBJECTIVE_POINT = 1;

export type VoteTotalingResult = {
  isComplete: boolean;
  rows: VoteTotalingRowViewModel[];
  selectedChallenges: VoteTotalingRowViewModel[];
};

export function calculateVoteTotaling({
  notes,
  memberCount,
  isVotingComplete,
}: {
  notes: Note[];
  memberCount: number;
  isVotingComplete?: boolean;
}): VoteTotalingResult {
  const subjective = notes.reduce(
    (total, note) => total + note.dotVotes.subjective.count,
    0,
  );
  const objective = notes.reduce(
    (total, note) => total + note.dotVotes.objective.count,
    0,
  );
  const allMembersCompletedVoting =
    memberCount > 0 &&
    subjective === memberCount * DOT_VOTE_LIMITS.subjective &&
    objective === memberCount * DOT_VOTE_LIMITS.objective;
  const isComplete = isVotingComplete ?? allMembersCompletedVoting;
  const rows = notes
    .map((note) => ({
      noteId: note.id,
      content: note.content,
      subjectiveCount: note.dotVotes.subjective.count,
      objectiveCount: note.dotVotes.objective.count,
      score:
        note.dotVotes.subjective.count * SUBJECTIVE_POINT +
        note.dotVotes.objective.count * OBJECTIVE_POINT,
      isSelectedChallenge: false,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.subjectiveCount - a.subjectiveCount ||
        a.noteId.localeCompare(b.noteId),
    );
  const leadingRow = rows.find((row) => row.subjectiveCount > 0);
  const selectedChallenges =
    isComplete && leadingRow
      ? rows.filter(
          (row) =>
            row.score === leadingRow.score &&
            row.subjectiveCount === leadingRow.subjectiveCount,
        )
      : [];
  return {
    isComplete,
    rows: rows.map((row) => ({
      ...row,
      isSelectedChallenge: selectedChallenges.some(
        (selected) => selected.noteId === row.noteId,
      ),
    })),
    selectedChallenges: selectedChallenges.map((row) => ({
      ...row,
      isSelectedChallenge: true,
    })),
  };
}

export function VoteTotalingPanel({
  notes,
  members,
  isVotingComplete,
}: {
  notes: Note[];
  members: Member[];
  // phase4 への遷移時に RoomDO が投票完了を保証する。以後にメンバーが
  // 退出しても、確定済み結果を待機状態へ戻さないための明示的な状態。
  isVotingComplete?: boolean;
}) {
  const result = calculateVoteTotaling({
    notes,
    memberCount: members.length,
    isVotingComplete,
  });
  if (!result.isComplete) {
    return (
      <section
        className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-background p-5 text-center"
        aria-label="投票結果"
      >
        <h2 className="font-semibold">投票結果</h2>
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          全員の投票完了を待っています
        </p>
      </section>
    );
  }
  return (
    <section
      className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-background p-5 shadow-sm sm:p-8"
      aria-label="投票結果"
      data-testid="vote-result-ranking"
    >
      <div className="text-center">
        <h2 className="text-xl font-bold">投票結果</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          総合ポイントが高い順
        </p>
      </div>
      {result.selectedChallenges.length > 0 ? (
        <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center">
          <p className="text-xs font-semibold text-emerald-800">取り組む課題</p>
          <ul className="mt-1 grid gap-1 font-semibold text-emerald-950">
            {result.selectedChallenges.map((challenge) => (
              <li key={challenge.noteId}>
                {challenge.content || "無題の付箋"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ol className="mt-6 grid gap-3">
        {result.rows.map((row, _index, ranking) => {
          const rank =
            ranking.findIndex(
              (candidate) =>
                candidate.score === row.score &&
                candidate.subjectiveCount === row.subjectiveCount,
            ) + 1;
          return <VoteTotalingRow key={row.noteId} row={row} rank={rank} />;
        })}
      </ol>
    </section>
  );
}
