"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DotVoteKind, ProtocolNote } from "@/contracts/room-protocol";
import { DotVoteButton } from "./dot-vote-button";

export type DotVoteRemaining = Record<DotVoteKind, number>;

type DotVoteControlsProps = {
  noteId: string;
  dotVotes: ProtocolNote["dotVotes"];
  voteRemaining: DotVoteRemaining;
  disabled?: boolean;
  onVote: (noteId: string, kind: DotVoteKind) => void;
  onVoteReset: (noteId: string, kind: DotVoteKind) => void;
};

const DOT_VOTE_KINDS: readonly DotVoteKind[] = ["subjective", "objective"];

export function DotVoteControls({
  noteId,
  dotVotes,
  voteRemaining,
  disabled = false,
  onVote,
  onVoteReset,
}: DotVoteControlsProps) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-2">
      {DOT_VOTE_KINDS.map((kind) => {
        const summary = dotVotes[kind];
        const isLimitReached = voteRemaining[kind] <= 0;
        const isObjective = kind === "objective";
        const isDisabled =
          disabled ||
          (isObjective ? isLimitReached : !summary.votedByMe && isLimitReached);
        const displayCount = summary.count ?? summary.ownCount;

        return (
          <div key={kind} className="flex items-center gap-1">
            <DotVoteButton
              kind={kind}
              // 投票中は総数が非公開なので、本人の投票数を表示する。
              count={displayCount}
              votedByMe={summary.votedByMe}
              disabled={isDisabled}
              onClick={() => onVote(noteId, kind)}
            />
            {kind === "objective" && summary.ownCount > 0 ? (
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                aria-label="客観ドットを0に戻す"
                title="客観ドットを0に戻す"
                disabled={disabled}
                onClick={() => onVoteReset(noteId, kind)}
              >
                <X />
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
