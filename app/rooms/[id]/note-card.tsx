"use client";

// 付箋1枚の表示用コンポーネント。Supabase には一切依存せず、位置(x, y)や
// 本文はすべてpropsで受け取り、変化はコールバックpropsで親（room-board.tsx）へ
// 通知するだけの「表示 + 生のポインター操作」コンポーネントにする。
// 状態の保持・永続化・Realtime配信は呼び出し側の責務。
import { useEffect, useRef, useState } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  NOTE_HEIGHT,
  NOTE_WIDTH,
} from "@/app/rooms/board-constants";
import type { Note } from "@/app/rooms/notes-reducer";

export type NoteCardProps = {
  note: Note;
  // 自分自身が現在ドラッグ中かどうか。trueの間はドラッグハンドルの見た目を変える。
  isOwnDrag: boolean;
  onDragStart: (noteId: string) => void;
  onDragMove: (noteId: string, x: number, y: number) => void;
  onDragEnd: (noteId: string, x: number, y: number) => void;
  onContentChange: (noteId: string, content: string) => void;
  onDelete: (noteId: string) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type DragOrigin = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

export function NoteCard({
  note,
  isOwnDrag,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContentChange,
  onDelete,
}: NoteCardProps) {
  const [localContent, setLocalContent] = useState(note.content);
  const isFocusedRef = useRef(false);
  const dragOriginRef = useRef<DragOrigin | null>(null);

  // 他ユーザーの編集がRealtime経由で届いたら反映する。
  // ただし自分がテキストエリアにフォーカスしている間は上書きしない
  // （タイピング中に他人の更新で巻き戻るのを防ぐ）。
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalContent(note.content);
    }
  }, [note.content]);

  function nextPosition(clientX: number, clientY: number) {
    const origin = dragOriginRef.current;
    if (!origin) {
      return null;
    }
    const dx = clientX - origin.startClientX;
    const dy = clientY - origin.startClientY;
    return {
      x: clamp(origin.startX + dx, 0, BOARD_WIDTH - NOTE_WIDTH),
      y: clamp(origin.startY + dy, 0, BOARD_HEIGHT - NOTE_HEIGHT),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragOriginRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: note.x,
      startY: note.y,
    };
    onDragStart(note.id);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const position = nextPosition(event.clientX, event.clientY);
    if (!position) {
      return;
    }
    onDragMove(note.id, position.x, position.y);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const position = nextPosition(event.clientX, event.clientY);
    dragOriginRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!position) {
      return;
    }
    onDragEnd(note.id, position.x, position.y);
  }

  return (
    <div
      data-slot="note-card"
      className="absolute flex flex-col overflow-hidden rounded-md border border-border bg-amber-100 shadow-sm dark:bg-amber-900"
      style={{
        left: note.x,
        top: note.y,
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
      }}
    >
      <div
        data-testid="note-drag-handle"
        role="presentation"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`flex shrink-0 cursor-grab items-center justify-end gap-1 px-1.5 py-1 touch-none select-none ${
          isOwnDrag
            ? "bg-amber-300 dark:bg-amber-700"
            : "bg-amber-200 dark:bg-amber-800"
        }`}
      >
        <button
          type="button"
          aria-label="削除"
          onClick={() => onDelete(note.id)}
          className="rounded px-1 text-xs text-amber-900 hover:bg-amber-400/50 dark:text-amber-100"
        >
          削除
        </button>
      </div>
      <textarea
        value={localContent}
        onChange={(event) => setLocalContent(event.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={(event) => {
          isFocusedRef.current = false;
          onContentChange(note.id, event.target.value);
        }}
        className="flex-1 resize-none bg-transparent p-2 text-sm text-amber-950 outline-none dark:text-amber-50"
        placeholder="メモを入力..."
      />
    </div>
  );
}
