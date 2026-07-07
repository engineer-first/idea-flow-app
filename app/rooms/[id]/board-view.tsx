"use client";

import { useCallback, useState } from "react";
import { CopyInviteButton } from "@/app/rooms/[id]/copy-invite-button";
import { NoteCard } from "@/app/rooms/[id]/note-card";
// ルームボードの表示用コンポーネント。データ層には一切依存せず、
// 付箋の配列と各種コールバックをpropsで受け取る。
// WebSocket接続・スロットル・プロトコル送信はroom-board.tsx（コンテナ）の責務。
// 「どの付箋を選択中か」は同期不要な純粋にUIの関心事なので、ここでローカルに持つ。
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/app/rooms/board-constants";
import type { Note } from "@/app/rooms/notes-reducer";
import { Button } from "@/components/ui/button";

export type BoardViewProps = {
  notes: Note[];
  inviteCode: string;
  inviteUrl: string;
  draggingNoteId: string | null;
  onAddNote: () => void;
  onNoteDragStart: (noteId: string) => void;
  onNoteDragMove: (noteId: string, x: number, y: number) => void;
  onNoteDragEnd: (noteId: string, x: number, y: number) => void;
  onNoteContentChange: (noteId: string, content: string) => void;
  onNoteDelete: (noteId: string) => void;
};

export function BoardView({
  notes,
  inviteCode,
  inviteUrl,
  draggingNoteId,
  onAddNote,
  onNoteDragStart,
  onNoteDragMove,
  onNoteDragEnd,
  onNoteContentChange,
  onNoteDelete,
}: BoardViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

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
        <Button type="button" onClick={onAddNote}>
          付箋を追加
        </Button>
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
