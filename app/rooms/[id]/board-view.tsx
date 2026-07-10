"use client";

import { useCallback, useState, useEffect } from "react";
import { CopyInviteButton } from "@/app/rooms/[id]/copy-invite-button";
import { NoteCard } from "@/app/rooms/[id]/note-card";
import { calculateRenderGroups, type PersistentGroup } from "@/contracts/grouping";
import { NoteGroupCard } from "@/app/rooms/[id]/note-group-card";
import type { Note } from "@/app/rooms/notes-reducer";
import { Button } from "@/components/ui/button";
// ルームボードの表示用コンポーネント。データ層には一切依存せず、
// 付箋の配列と各種コールバックをpropsで受け取る。
// WebSocket接続・スロットル・プロトコル送信はroom-board.tsx（コンテナ）の責務。
// 「どの付箋を選択中か」は同期不要な純粋にUIの関心事なので、ここでローカルに持つ。
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/contracts/board";

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
  groups: PersistentGroup[];
  inviteCode: string;
  inviteUrl: string;
  connectionStatus: BoardConnectionStatus;
  draggingNoteId: string | null;
  onAddNote: () => void;
  onNoteDragStart: (noteId: string) => void;
  onNoteDragMove: (noteId: string, x: number, y: number) => void;
  onNoteDragEnd: (noteId: string, x: number, y: number) => void;
  onNoteContentChange: (noteId: string, content: string) => void;
  onNoteDelete: (noteId: string) => void;
  onGroupCreate?: (name: string, noteIds: string[]) => void;
  onGroupUpdateName?: (groupId: string, name: string) => void;
};

export function BoardView({
  notes,
  groups,
  inviteCode,
  inviteUrl,
  connectionStatus,
  draggingNoteId,
  onAddNote,
  onNoteDragStart,
  onNoteDragMove,
  onNoteDragEnd,
  onNoteContentChange,
  onNoteDelete,
  onGroupCreate,
  onGroupUpdateName,
}: BoardViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ハイドレーション直後の高速接続確立によるMismatchedを防ぐため、マウント完了までは接続中（非活性）扱いにする
  const isDisconnected = isMounted ? connectionStatus !== "open" : true;

  const renderGroups = calculateRenderGroups(notes, groups);

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
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>招待URL</span>
            <span className="max-w-[18rem] truncate font-mono text-xs text-foreground">
              {inviteUrl}
            </span>
            <CopyInviteButton url={inviteUrl} />
          </span>
          <span className="text-sm text-muted-foreground">
            または招待コード:{" "}
            <span className="font-mono text-base font-semibold text-foreground">
              {inviteCode}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
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

          {renderGroups.map((rg) => {
            const handleUpdateName = (newName: string) => {
              if (rg.isTemp && rg.representativeNoteId) {
                const noteIds = rg.id.replace("temp-", "").split(",");
                onGroupCreate?.(newName, noteIds);
              } else if (rg.persistentGroupId) {
                onGroupUpdateName?.(rg.persistentGroupId, newName);
              }
            };

            return (
              <NoteGroupCard
                key={rg.id}
                group={rg}
                name={rg.name}
                onUpdateName={handleUpdateName}
              />
            );
          })}

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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
