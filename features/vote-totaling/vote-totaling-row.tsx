import { VoteCountBadge } from "./vote-count-badge";

export type VoteTotalingRowViewModel = {
  noteId: string;
  content: string;
  subjectiveCount: number;
  objectiveCount: number;
  score: number;
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
        <span className="inline-flex h-7 items-center rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium tabular-nums text-zinc-900">
          {row.score}点
        </span>
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
