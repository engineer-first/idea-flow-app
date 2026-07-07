"use client";

// 付箋1枚の表示用コンポーネント。データ層には一切依存せず、位置(x, y)や
// 本文はすべてpropsで受け取り、変化はコールバックpropsで親へ通知するだけの
// コンポーネントにする。状態の保持・永続化・リアルタイム配信は呼び出し側の責務。
//
// インタラクションは tldraw の Note shape（SelectTool/PointingShape）を踏襲:
//   - pointerdown で選択し、閾値(DRAG_THRESHOLD_PX)を超えて動かすとドラッグ
//   - 「pointerdown 時点で選択済みだった」付箋への移動なしクリックで編集開始
//   - 選択中（非編集）は Backspace / Delete で削除、Enter でも編集開始
// 選択状態(isSelected)は「同時に1枚だけ」という付箋間の関心事なので親が持ち、
// 編集状態(isEditing)はこの付箋に閉じた関心事なのでローカルに持つ。
import { useEffect, useRef, useState } from "react";
import { getNoteShadow } from "@/app/rooms/[id]/note-shadow";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DRAG_THRESHOLD_PX,
  NOTE_HEIGHT,
  NOTE_WIDTH,
} from "@/app/rooms/board-constants";
import type { Note } from "@/app/rooms/notes-reducer";
import { NOTE_CONTENT_MAX_LENGTH } from "@/contracts/room-protocol";

export type NoteCardProps = {
  note: Note;
  // 自分自身が現在ドラッグ中かどうか。trueの間は影を深くして「持ち上げた」見た目にする。
  isOwnDrag: boolean;
  isSelected: boolean;
  onSelect: (noteId: string) => void;
  onDragStart: (noteId: string) => void;
  onDragMove: (noteId: string, x: number, y: number) => void;
  onDragEnd: (noteId: string, x: number, y: number) => void;
  onContentChange: (noteId: string, content: string) => void;
  onDelete: (noteId: string) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type PointerOrigin = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  // pointerdown 時点で選択済みだったか。これが true の「移動なしクリック」を
  // 編集開始の合図にする（tldraw と同じ2段階クリック）。
  wasSelected: boolean;
  didDrag: boolean;
};

export function NoteCard({
  note,
  isOwnDrag,
  isSelected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContentChange,
  onDelete,
}: NoteCardProps) {
  const [localContent, setLocalContent] = useState(note.content);
  const [isEditing, setIsEditing] = useState(false);
  const pointerOriginRef = useRef<PointerOrigin | null>(null);
  const surfaceRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 他ユーザーの編集がRealtime経由で届いたら反映する。
  // ただし自分が編集モードの間は上書きしない
  // （タイピング中に他人の更新で巻き戻るのを防ぐ）。
  useEffect(() => {
    if (!isEditing) {
      setLocalContent(note.content);
    }
  }, [note.content, isEditing]);

  // 選択が外れたら編集モードも終了する（選択は編集の前提状態）。
  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
    }
  }, [isSelected]);

  // 状態に応じてフォーカスを移す。サーフェスにフォーカスがないと
  // Backspace削除などのキー操作を受け取れない。
  useEffect(() => {
    if (isEditing) {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        const caret = textarea.value.length;
        textarea.setSelectionRange(caret, caret);
      }
    } else if (isSelected) {
      surfaceRef.current?.focus();
    }
  }, [isEditing, isSelected]);

  function positionFrom(clientX: number, clientY: number) {
    const origin = pointerOriginRef.current;
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

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerOriginRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: note.x,
      startY: note.y,
      wasSelected: isSelected,
      didDrag: false,
    };
    if (!isSelected) {
      onSelect(note.id);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const origin = pointerOriginRef.current;
    if (!origin) {
      return;
    }
    if (!origin.didDrag) {
      const distance = Math.hypot(
        event.clientX - origin.startClientX,
        event.clientY - origin.startClientY,
      );
      if (distance < DRAG_THRESHOLD_PX) {
        return;
      }
      origin.didDrag = true;
      onDragStart(note.id);
    }
    const position = positionFrom(event.clientX, event.clientY);
    if (!position) {
      return;
    }
    onDragMove(note.id, position.x, position.y);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const origin = pointerOriginRef.current;
    const position = positionFrom(event.clientX, event.clientY);
    pointerOriginRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!origin) {
      return;
    }
    if (origin.didDrag) {
      if (position) {
        onDragEnd(note.id, position.x, position.y);
      }
      return;
    }
    if (origin.wasSelected) {
      setIsEditing(true);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      onDelete(note.id);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      setIsEditing(true);
    }
  }

  return (
    <div
      data-slot="note-card"
      data-testid="note-card"
      data-selected={isSelected || undefined}
      data-editing={isEditing || undefined}
      className={`absolute flex flex-col overflow-hidden rounded-[2px] bg-amber-100 dark:bg-amber-900 ${
        isSelected
          ? "outline-2 outline-blue-500 dark:outline-blue-400"
          : "outline-none"
      }`}
      style={{
        left: note.x,
        top: note.y,
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        boxShadow: getNoteShadow(note.id, { isLifted: isOwnDrag }),
      }}
    >
      <textarea
        ref={textareaRef}
        value={localContent}
        readOnly={!isEditing}
        // サーバー（RoomDO）は上限超過を invalid-message で拒否するため、
        // UI 側でも同じコントラクト定数で「そもそも入力できない」形に塞ぐ。
        maxLength={NOTE_CONTENT_MAX_LENGTH}
        tabIndex={isEditing ? 0 : -1}
        onChange={(event) => setLocalContent(event.target.value)}
        onBlur={(event) => {
          setIsEditing(false);
          onContentChange(note.id, event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setIsEditing(false);
          }
        }}
        className={`flex-1 resize-none bg-transparent p-2 text-sm text-amber-950 outline-none dark:text-amber-50 ${
          isEditing ? "" : "pointer-events-none select-none"
        }`}
        placeholder="メモを入力..."
      />
      {!isEditing && (
        // 選択・ドラッグ・キー操作を受ける透明なサーフェス。
        // button要素は対話的な子要素(textarea)を持てないため、カード全体を
        // buttonにせず、非編集時だけ本文の上に実buttonを重ねる。
        // 編集中はアンマウントされるので、ポインター操作もBackspaceも
        // 自然にtextarea側へ渡る。
        <button
          ref={surfaceRef}
          type="button"
          aria-label="付箋"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
          className={`absolute inset-0 touch-none select-none outline-none ${
            isOwnDrag ? "cursor-grabbing" : "cursor-grab"
          }`}
        />
      )}
    </div>
  );
}
