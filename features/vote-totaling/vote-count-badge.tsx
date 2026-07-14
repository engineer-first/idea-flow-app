// VoteTotaling の molecule。基礎UIは components/ui を利用する。
type VoteCountBadgeProps = {
  label: string;
  value: number;
  tone: "subjective" | "objective" | "score";
};

const TONE_CLASSES: Record<VoteCountBadgeProps["tone"], string> = {
  subjective: "border-rose-200 bg-rose-50 text-rose-800",
  objective: "border-sky-200 bg-sky-50 text-sky-800",
  score: "border-zinc-300 bg-zinc-50 text-zinc-900",
};

export function VoteCountBadge({ label, value, tone }: VoteCountBadgeProps) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium tabular-nums ${TONE_CLASSES[tone]}`}
    >
      {label ? `${label} ${value}` : value}
    </span>
  );
}
