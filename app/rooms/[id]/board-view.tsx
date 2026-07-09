"use client";

import { useCallback, useState } from "react";
import { DotVoteSummary } from "@/app/components/dotvote/organisms/dot-vote-summary";
import { CopyInviteButton } from "@/app/rooms/[id]/copy-invite-button";
import { NoteCard } from "@/app/rooms/[id]/note-card";
import { RoomMembers } from "@/app/rooms/[id]/room-members";
import { LeaveConfirmDialog } from "@/app/rooms/leave-confirm-dialog";
import type { Note } from "@/app/rooms/notes-reducer";
import type { Member } from "@/app/rooms/room-reducer";
import { Button } from "@/components/ui/button";
// ルームボードの表示用コンポーネント。データ層には一切依存せず、
// 付箋の配列と各種コールバックをpropsで受け取る。
// WebSocket接続・スロットル・プロトコル送信はroom-board.tsx（コンテナ）の責務。
// 「どの付箋を選択中か」は同期不要な純粋にUIの関心事なので、ここでローカルに持つ。
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/contracts/board";
import { DOT_VOTE_LIMITS, type DotVoteKind, type Phase } from "@/contracts/room-protocol";

// WebSocket 接続の表示用状態。値の生成は room-board（コンテナ）の責務で、
// ここでは受け取った状態を表示するだけ（このコンポーネントはデータ層に依存しない）。
export type BoardConnectionStatus = "connecting" | "open" | "closed";

const CONNECTION_STATUS_LABELS: Record<BoardConnectionStatus, string | null> = {
  connecting: "接続中…",
  open: null,
  closed: "接続が切れました。再接続します…",
};

export type BoardViewProps = {
  notes: Note[];
  inviteCode: string;
  inviteUrl: string;
  connectionStatus: BoardConnectionStatus;
  draggingNoteId: string | null;
  members: Member[];
  currentUserId: string;
  isHost: boolean;
  // ホストの userId（メンバー一覧の「ホスト」ラベル表示用）。
  hostUserId: string;
  phase: Phase;
  onAddNote: () => void;
  onNoteDragStart: (noteId: string) => void;
  onNoteDragMove: (noteId: string, x: number, y: number) => void;
  onNoteDragEnd: (noteId: string, x: number, y: number) => void;
  onNoteContentChange: (noteId: string, content: string) => void;
  onNoteDelete: (noteId: string) => void;
  onNoteVote: (noteId: string, kind: DotVoteKind) => void;
  onNoteVoteReset: (noteId: string, kind: DotVoteKind) => void;
  // 退出（#70 退室機能）。
  onLeave: () => void;
  // 退出処理中（多重押下防止）。true の間「退出する」ボタンは disabled。
  isLeaving: boolean;
};

export function BoardView({
  notes,
  inviteCode,
  inviteUrl,
  connectionStatus,
  draggingNoteId,
  members,
  currentUserId,
  isHost,
  hostUserId,
  phase,
  onAddNote,
  onNoteDragStart,
  onNoteDragMove,
  onNoteDragEnd,
  onNoteContentChange,
  onNoteDelete,
  onNoteVote,
  onNoteVoteReset,
  onLeave,
  isLeaving,
}: BoardViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  // 未接続中は room-client が送信を黙って破棄するため、操作自体を無効化する。
  const isDisconnected = connectionStatus !== "open";
  const voteRemaining = {
    subjective: Math.max(
      0,
      DOT_VOTE_LIMITS.subjective -
        notes.reduce(
          (used, note) => used + note.dotVotes.subjective.ownCount,
          0,
        ),
    ),
    objective: Math.max(
      0,
      DOT_VOTE_LIMITS.objective -
        notes.reduce(
          (used, note) => used + note.dotVotes.objective.ownCount,
          0,
        ),
    ),
  };

  function handleBoardPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // 付箋の上のpointerdownはバブリングしてくるので、ボード背景を
    // 直接押したときだけ選択を解除する。
    if (event.target === event.currentTarget) {
      setSelectedNoteId(null);
    }
  }

  const handleNoteDelete = useCallback(
    (noteId: string) => {
      setSelectedNoteId((current) => (current === noteId ? null : current));
      onNoteDelete(noteId);
    },
    [onNoteDelete],
  );

  return (
    <div className="flex h-full flex-col gap-3">
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
            // ボード画面の上部バーは招待URL/状態/ボタン群で幅を取られるため、
            // 名前は Avatar の隣に常時表示しつつ、maxVisible=3 で 4 人目以降は
            // +N バッジに置き換える（start 画面は既定 5）。
            maxVisible={3}
          />
          <DotVoteSummary voteRemaining={voteRemaining} />
          {phase === "writing" ? null : (
            // ボード画面に「writing 以外」の状態で居る場合は start 画面への
            // 導線に過ぎない（通常は page.tsx の redirect でここに来ない）。
            <span className="text-xs text-muted-foreground">
              開始前: {phase}
            </span>
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
          <Button type="button" onClick={onAddNote} disabled={isDisconnected}>
            付箋を追加
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLeaveDialogOpen(true)}
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
        </div>
      </div>

      <div className="relative overflow-auto rounded-md border border-border bg-muted/30">
        <div
          data-testid="board-canvas"
          className="relative"
          style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
          onPointerDown={handleBoardPointerDown}
        >
          {notes.length === 0 ? (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              付箋がまだありません
            </p>
          ) : null}

          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isOwnDrag={draggingNoteId === note.id}
              isSelected={selectedNoteId === note.id}
              disabled={isDisconnected}
              onSelect={setSelectedNoteId}
              onDragStart={onNoteDragStart}
              onDragMove={onNoteDragMove}
              onDragEnd={onNoteDragEnd}
              onContentChange={onNoteContentChange}
              onDelete={handleNoteDelete}
              voteRemaining={voteRemaining}
              onVote={onNoteVote}
              onVoteReset={onNoteVoteReset}
            />
          ))}
        </div>
      </div>

      <LeaveConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onConfirm={onLeave}
        isLeaving={isLeaving}
        mode={isHost ? "disband" : "leave"}
      />
    </div>
  );
}
