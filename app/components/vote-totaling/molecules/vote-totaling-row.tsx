import { VoteCountBadge } from "@/app/components/vote-totaling/atoms/vote-count-badge";

export type VoteTotalingRowViewModel = {
  noteId: string;
  content: string;
  subjectiveCount: number;
  objectiveCount: number;
  voteCount: number;
};

type VoteTotalingRowProps = { row: VoteTotalingRowViewModel; rank: number };

export function VoteTotalingRow({ row, rank }: VoteTotalingRowProps) {
  return (
    <li
      className="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      data-testid={`vote-totaling-row-${row.noteId}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
          {rank}位
        </span>
        <p className="break-words text-sm font-medium text-foreground">
          {row.content || "無題の付箋"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <VoteCountBadge label="合計" value={row.voteCount} tone="score" />
        <VoteCountBadge
          label="主観"
          value={row.subjectiveCount}
          tone="subjective"
        />
        <VoteCountBadge
          label="客観"
          value={row.objectiveCount}
          tone="objective"
        />
      </div>
    </li>
  );
}
