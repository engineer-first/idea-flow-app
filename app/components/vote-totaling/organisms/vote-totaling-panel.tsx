import type { VoteTotalingRowViewModel } from "@/app/components/vote-totaling/molecules/vote-totaling-row";
import { VoteTotalingRow } from "@/app/components/vote-totaling/molecules/vote-totaling-row";
import type { Note } from "@/app/rooms/notes-reducer";
import type { Member } from "@/app/rooms/room-reducer";
import { DOT_VOTE_LIMITS } from "@/contracts/room-protocol";

export type VoteTotalingResult = {
  isComplete: boolean;
  rows: VoteTotalingRowViewModel[];
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
      voteCount: note.dotVotes.subjective.count + note.dotVotes.objective.count,
    }))
    .filter((row) => row.voteCount > 0)
    .sort(
      (a, b) =>
        b.voteCount - a.voteCount ||
        b.subjectiveCount - a.subjectiveCount ||
        a.noteId.localeCompare(b.noteId),
    );
  return {
    isComplete,
    rows,
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
        <h2 className="text-xl font-bold">投票結果</h2>
        <p className="mt-1 text-sm text-muted-foreground">投票数が多い順</p>
      </div>
      <ol className="mt-6 grid gap-3">
        {result.rows.map((row, _index, ranking) => {
          const rank =
            ranking.findIndex(
              (candidate) => candidate.voteCount === row.voteCount,
            ) + 1;
          return <VoteTotalingRow key={row.noteId} row={row} rank={rank} />;
        })}
      </ol>
    </section>
  );
}
