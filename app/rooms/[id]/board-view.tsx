"use client";

import { NoteCard } from "@/app/rooms/[id]/note-card";
// ルームボードの表示用コンポーネント。Supabase には一切依存せず、
// 付箋の配列と各種コールバックをpropsで受け取るだけにする。
// Realtimeの購読・スロットル・Server Actionsの呼び出しはroom-board.tsx（コンテナ）の責務。
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/app/rooms/board-constants";
import type { Note } from "@/app/rooms/notes-reducer";
import { Button } from "@/components/ui/button";

export type BoardViewProps = {
  notes: Note[];
  inviteCode: string;
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
  draggingNoteId,
  onAddNote,
  onNoteDragStart,
  onNoteDragMove,
  onNoteDragEnd,
  onNoteContentChange,
  onNoteDelete,
}: BoardViewProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <p className="text-sm text-muted-foreground">
          招待コード:{" "}
          <span className="font-mono text-base font-semibold text-foreground">
            {inviteCode}
          </span>
        </p>
        <Button type="button" onClick={onAddNote}>
          付箋を追加
        </Button>
      </div>

      <div className="relative overflow-auto rounded-md border border-border bg-muted/30">
        <div
          className="relative"
          style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
        >
          {notes.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              付箋がまだありません
            </p>
          ) : null}

          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isOwnDrag={draggingNoteId === note.id}
              onDragStart={onNoteDragStart}
              onDragMove={onNoteDragMove}
              onDragEnd={onNoteDragEnd}
              onContentChange={onNoteContentChange}
              onDelete={onNoteDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
