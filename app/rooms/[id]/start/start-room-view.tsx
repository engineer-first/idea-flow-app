"use client";

// スタート画面（メンバー一覧 + 開始ボタン）のプレゼンテーション層。
// データ層に依存せず、表示と操作の橋渡しだけを担う。WebSocket 接続や
// プロトコル送信は room-start-board.tsx（コンテナ）の責務。
import { CopyInviteButton } from "@/app/rooms/[id]/copy-invite-button";
import { RoomMembers } from "@/app/rooms/[id]/room-members";
import type { Member } from "@/app/rooms/room-reducer";
import { Button } from "@/components/ui/button";
import type { Phase } from "@/contracts/room-protocol";

// 接続状態は Container 側で生成し、ここでは表示するだけ。
export type StartConnectionStatus = "connecting" | "open" | "closed";

const CONNECTION_STATUS_LABELS: Record<StartConnectionStatus, string | null> = {
  connecting: "接続中…",
  open: null,
  closed: "接続が切れました。再接続します…",
};

export type StartRoomViewProps = {
  members: Member[];
  currentUserId: string;
  isHost: boolean;
  phase: Phase;
  inviteCode: string;
  inviteUrl: string;
  connectionStatus: StartConnectionStatus;
  // 開始ボタンが処理中のとき true（多重押下防止）。Container が setTimeout などで
  // 制御する想定。
  isStarting: boolean;
  onStart: () => void;
};

export function StartRoomView({
  members,
  currentUserId,
  isHost,
  phase,
  inviteCode,
  inviteUrl,
  connectionStatus,
  isStarting,
  onStart,
}: StartRoomViewProps) {
  const isDisconnected = connectionStatus !== "open";

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-8"
      data-testid="start-room-view"
      data-phase={phase}
      data-host={isHost ? "true" : undefined}
    >
      <div className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-sm text-muted-foreground">現在のフェーズ</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
            {phase === "lobby" ? "開始前" : phase}
          </span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-muted-foreground">
            参加中のメンバー
          </span>
          <RoomMembers members={members} currentUserId={currentUserId} />
          <span
            className="text-xs text-muted-foreground"
            data-testid="start-room-view-member-count"
          >
            {members.length} 名
          </span>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-sm text-muted-foreground">招待URL</span>
          <span className="flex items-center gap-2 text-sm">
            <span className="max-w-[18rem] truncate font-mono text-xs">
              {inviteUrl}
            </span>
            <CopyInviteButton url={inviteUrl} />
          </span>
          <span className="text-xs text-muted-foreground">
            または招待コード:{" "}
            <span className="font-mono text-sm font-semibold text-foreground">
              {inviteCode}
            </span>
          </span>
        </div>

        {isHost ? (
          <Button
            type="button"
            onClick={onStart}
            disabled={isDisconnected || isStarting}
            data-testid="start-phase-button"
            size="lg"
            className="min-w-[12rem]"
          >
            {isStarting ? "開始中…" : "開始する"}
          </Button>
        ) : (
          <p
            data-testid="start-room-view-waiting"
            className="text-sm text-muted-foreground"
          >
            ホストが開始するのをお待ちください
          </p>
        )}

        {CONNECTION_STATUS_LABELS[connectionStatus] !== null ? (
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
        ) : null}
      </div>
    </div>
  );
}
