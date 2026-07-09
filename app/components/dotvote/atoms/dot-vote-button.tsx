"use client";

import { Circle, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DotVoteKind } from "@/contracts/room-protocol";

type DotVoteButtonProps = {
  kind: DotVoteKind;
  count: number;
  votedByMe: boolean;
  disabled?: boolean;
  onClick: () => void;
};

const DOT_VOTE_LABELS: Record<DotVoteKind, string> = {
  subjective: "主観",
  objective: "客観",
};

const DOT_VOTE_TONES: Record<DotVoteKind, string> = {
  subjective:
    "data-[voted=true]:bg-rose-600 data-[voted=true]:text-white data-[voted=true]:hover:bg-rose-700",
  objective:
    "data-[voted=true]:bg-sky-600 data-[voted=true]:text-white data-[voted=true]:hover:bg-sky-700",
};

export function DotVoteButton({
  kind,
  count,
  votedByMe,
  disabled = false,
  onClick,
}: DotVoteButtonProps) {
  const label = DOT_VOTE_LABELS[kind];
  const Icon = votedByMe ? CircleDot : Circle;
  const actionLabel =
    kind === "objective" ? "を追加" : votedByMe ? "投票を取り消す" : "を投票";

  return (
    <Button
      type="button"
      size="xs"
      variant={votedByMe ? "default" : "outline"}
      data-voted={votedByMe}
      aria-pressed={votedByMe}
      aria-label={`${label}ドット${actionLabel}`}
      title={`${label}ドット${actionLabel}`}
      disabled={disabled}
      onClick={onClick}
      className={DOT_VOTE_TONES[kind]}
    >
      <Icon data-icon="inline-start" />
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </Button>
  );
}
