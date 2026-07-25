"use client";

// ボード画面上部のヘッダー。招待情報（host 限定）・メンバー一覧・残り投票数・
// フェーズ表示と移行操作・接続状態・退出/解散・タイマーを 1 列に束ねる。
// データ層には依存せず、表示状態とコールバックを props で受け取る。
import { Button } from "@/components/ui/button";
import { isResultStep, type RoomPhase } from "@/contracts/phase";
import type { TimerState } from "@/contracts/room-protocol";
import type { DotVoteRemaining } from "@/features/dot-vote";
import { DotVoteSummary } from "@/features/dot-vote";
import { CopyInviteButton } from "@/features/invite";
import { RoomMembers } from "@/features/room-members";
import {
  CONNECTION_STATUS_LABELS,
  type RoomScreenConnectionStatus,
} from "../logic/connection-status";
import { getPhaseLabel } from "../logic/phase-labels";
import type { Member } from "../logic/room-reducer";
import { NextPhaseConfirmDialog } from "../molecules/next-phase-confirm-dialog";
import { RoomTimer } from "./room-timer";

export type RoomBoardHeaderProps = {
  inviteCode: string;
  inviteUrl: string;
  phase: RoomPhase;
  timer: TimerState;
  timerServerOffsetMs: number;
  isHost: boolean;
  // ハイドレーション対策込みの「操作を止めるべきか」。判定は view の責務。
  isDisconnected: boolean;
  connectionStatus: RoomScreenConnectionStatus;
  members: Member[];
  currentUserId: string;
  hostUserId: string;
  isNextPhasePending: boolean;
  // 「次のステップへ」を進められない状態（決定待ち・次ステップ未実装など）。
  // 判定は view の責務で、ここでは受け取った状態で無効化するだけ。
  isNextPhaseBlocked: boolean;
  voteRemaining: DotVoteRemaining;
  isLeaving: boolean;
  onShowVoteResult: () => void;
  onLeaveClick: () => void;
  onNextPhase: () => void;
  onTimerStart: (durationMs: number) => void;
  onTimerPause: () => void;
  onTimerResume: () => void;
  onTimerExtend: () => void;
  onTimerStop: () => void;
};

export function RoomBoardHeader({
  inviteCode,
  inviteUrl,
  phase,
  timer,
  timerServerOffsetMs,
  isHost,
  isDisconnected,
  connectionStatus,
  members,
  currentUserId,
  hostUserId,
  isNextPhasePending,
  isNextPhaseBlocked,
  voteRemaining,
  isLeaving,
  onShowVoteResult,
  onLeaveClick,
  onNextPhase,
  onTimerStart,
  onTimerPause,
  onTimerResume,
  onTimerExtend,
  onTimerStop,
}: RoomBoardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {isHost ? (
          // 招待URL / 招待コードはホストだけが共有できる情報。
          // 値自体を表示し、クリックでコピー。中央揃え。
          <div
            className="flex max-w-full flex-col items-center gap-3"
            data-testid="board-view-invite"
          >
            <div className="flex max-w-full flex-col items-center gap-0.5">
              <span className="text-xs text-muted-foreground">招待URL</span>
              <CopyInviteButton value={inviteUrl} itemLabel="招待URL" />
            </div>
            <div className="flex max-w-full flex-col items-center gap-0.5">
              <span className="text-xs text-muted-foreground">招待コード</span>
              <CopyInviteButton value={inviteCode} itemLabel="招待コード" />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RoomMembers
          members={members}
          currentUserId={currentUserId}
          hostUserId={hostUserId}
        />
        <DotVoteSummary voteRemaining={voteRemaining} />
        <span className="text-sm text-muted-foreground">
          現在のステップ:
          <span className="ml-1 font-semibold text-foreground">
            {getPhaseLabel(phase)}
          </span>
        </span>

        {isHost && (
          <NextPhaseConfirmDialog
            phase={phase}
            disabled={
              isDisconnected || isNextPhasePending || isNextPhaseBlocked
            }
            onConfirm={onNextPhase}
          />
        )}

        {CONNECTION_STATUS_LABELS[connectionStatus] !== null && (
          // role="status"（aria-live: polite）で、再接続をスクリーンリーダーにも通知する。
          <span
            role="status"
            className={`text-sm ${
              connectionStatus === "closed"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {CONNECTION_STATUS_LABELS[connectionStatus]}
          </span>
        )}
        {isResultStep(phase) ? (
          <Button type="button" onClick={onShowVoteResult}>
            投票結果を表示
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={onLeaveClick}
          disabled={isLeaving}
          data-testid="leave-button"
        >
          {isHost
            ? isLeaving
              ? "解散中…"
              : "ルームを解散"
            : isLeaving
              ? "退出中…"
              : "退出する"}
        </Button>
        <RoomTimer
          timer={timer}
          serverOffsetMs={timerServerOffsetMs}
          isHost={isHost}
          disabled={isDisconnected}
          onStart={onTimerStart}
          onPause={onTimerPause}
          onResume={onTimerResume}
          onExtend={onTimerExtend}
          onStop={onTimerStop}
        />
      </div>
    </div>
  );
}
