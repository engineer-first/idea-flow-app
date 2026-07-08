"use client";

import { useState } from "react";
// スタート画面（メンバー一覧 + 開始ボタン）のプレゼンテーション層。
// データ層に依存せず、表示と操作の橋渡しだけを担う。WebSocket 接続や
// プロトコル送信は room-start-board.tsx（コンテナ）の責務。
// shadcn 風の Card / Field / Label / Input コンポーネントを積極採用し、
// デザインと挙動の責任分界を明確にする。
import { CopyInviteButton } from "@/app/rooms/[id]/copy-invite-button";
import { RoomMembers } from "@/app/rooms/[id]/room-members";
import { LeaveConfirmDialog } from "@/app/rooms/leave-confirm-dialog";
import type { Member } from "@/app/rooms/room-reducer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  // 退出（#70 退室機能）。
  onLeave: () => void;
  isLeaving: boolean;
};

const PHASE_LABELS: Record<Phase, string> = {
  lobby: "開始前",
  writing: "進行中",
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
  onLeave,
  isLeaving,
}: StartRoomViewProps) {
  const isDisconnected = connectionStatus !== "open";
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  return (
    <div
      className="flex h-full items-center justify-center p-4"
      data-testid="start-room-view"
      data-phase={phase}
      data-host={isHost ? "true" : undefined}
    >
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardDescription>現在のフェーズ</CardDescription>
          <CardTitle data-testid="start-room-view-phase">
            {PHASE_LABELS[phase]}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
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

          {isHost ? (
            // 招待URL / 招待コードはホストだけが共有できる情報。
            // 非ホストには伏せて、誤って共有するリスクを避ける。
            <div
              className="flex flex-col items-center gap-2"
              data-testid="start-room-view-invite"
            >
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
          ) : null}

          {CONNECTION_STATUS_LABELS[connectionStatus] !== null ? (
            <p
              role="status"
              className={`text-center text-sm ${
                connectionStatus === "closed"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {CONNECTION_STATUS_LABELS[connectionStatus]}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {isHost ? (
            <Button
              type="button"
              onClick={onStart}
              disabled={isDisconnected || isStarting}
              data-testid="start-phase-button"
              size="lg"
              className="w-full"
            >
              {isStarting ? "開始中…" : "開始する"}
            </Button>
          ) : (
            <p
              data-testid="start-room-view-waiting"
              className="w-full text-center text-sm text-muted-foreground"
            >
              ホストが開始するのをお待ちください
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setLeaveDialogOpen(true)}
            disabled={isLeaving}
            data-testid="leave-button"
            className="w-full"
          >
            {isLeaving ? "退出中…" : "退出する"}
          </Button>
        </CardFooter>
      </Card>

      <LeaveConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onConfirm={onLeave}
        isLeaving={isLeaving}
      />
    </div>
  );
}
