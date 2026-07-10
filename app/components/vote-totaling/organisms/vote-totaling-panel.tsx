import type { VoteTotalingRowViewModel } from "@/app/components/vote-totaling/molecules/vote-totaling-row";
import { VoteTotalingRow } from "@/app/components/vote-totaling/molecules/vote-totaling-row";
import type { Note } from "@/app/rooms/notes-reducer";
import type { Member } from "@/app/rooms/room-reducer";
import { DOT_VOTE_LIMITS } from "@/contracts/room-protocol";

const SUBJECTIVE_POINT = 5;
const OBJECTIVE_POINT = 1;
const RANKING_LIMIT = 3;

export type VoteTotalingResult = {
  isComplete: boolean;
  rows: VoteTotalingRowViewModel[];
  selectedChallenge: VoteTotalingRowViewModel | null;
};

export function calculateVoteTotaling({
  notes,
  memberCount,
}: {
  notes: Note[];
  memberCount: number;
}): VoteTotalingResult {
  const subjective = notes.reduce(
    (total, note) => total + note.dotVotes.subjective.count,
    0,
  );
  const objective = notes.reduce(
    (total, note) => total + note.dotVotes.objective.count,
    0,
  );
  const isComplete =
    memberCount > 0 &&
    subjective === memberCount * DOT_VOTE_LIMITS.subjective &&
    objective === memberCount * DOT_VOTE_LIMITS.objective;
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
    .sort((a, b) => b.score - a.score);
  const selectedChallenge = isComplete
    ? (rows.find((row) => row.subjectiveCount > 0) ?? null)
    : null;
  return {
    isComplete,
    rows: rows.map((row) => ({
      ...row,
      isSelectedChallenge: row.noteId === selectedChallenge?.noteId,
    })),
    selectedChallenge: selectedChallenge
      ? { ...selectedChallenge, isSelectedChallenge: true }
      : null,
  };
}

export function VoteTotalingPanel({
  notes,
  members,
}: {
  notes: Note[];
  members: Member[];
}) {
  const result = calculateVoteTotaling({ notes, memberCount: members.length });
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
        <h2 className="text-sm font-semibold text-primary">投票結果</h2>
        <p className="mt-1 text-2xl font-bold">TOP 3</p>
        <p className="mt-1 text-sm text-muted-foreground">
          主観5点・客観1点で集計
        </p>
      </div>
      {result.selectedChallenge ? (
        <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center">
          <p className="text-xs font-semibold text-emerald-800">取り組む課題</p>
          <p className="mt-1 font-semibold text-emerald-950">
            {result.selectedChallenge.content || "無題の付箋"}
          </p>
        </div>
      ) : null}
      <ol className="mt-6 grid gap-3">
        {result.rows.slice(0, RANKING_LIMIT).map((row, index) => (
          <VoteTotalingRow key={row.noteId} row={row} rank={index + 1} />
        ))}
      </ol>
    </section>
  );
}
