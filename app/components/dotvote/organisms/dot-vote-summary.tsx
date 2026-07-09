import type { DotVoteRemaining } from "@/app/components/dotvote/molecules/dot-vote-controls";

type DotVoteSummaryProps = {
  voteRemaining: DotVoteRemaining;
};

export function DotVoteSummary({ voteRemaining }: DotVoteSummaryProps) {
  return (
    <fieldset className="flex items-center gap-2 text-sm">
      <legend className="sr-only">残り投票可能数</legend>
      <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
        主観 残り{voteRemaining.subjective}
      </span>
      <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
        客観 残り{voteRemaining.objective}
      </span>
    </fieldset>
  );
}
