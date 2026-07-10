import type * as React from "react";
import { getNoteShadow } from "@/app/rooms/[id]/note-shadow";
import { NOTE_HEIGHT, NOTE_WIDTH } from "@/contracts/board";
import type { NoteColor } from "@/contracts/room-protocol";
import { cn } from "@/lib/utils";

export type StickyNoteProps = {
  noteId: string;
  isLifted?: boolean;
  isSelected?: boolean;
  color?: NoteColor;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  testId?: string;
  "data-editing"?: boolean;
};

const COLOR_CLASSES: Record<NoteColor, string> = {
  yellow: "bg-amber-50",
  green: "bg-emerald-50",
  blue: "bg-sky-50",
  pink: "bg-rose-50",
  orange: "bg-orange-50",
  purple: "bg-purple-50",
};

// RoomBoard の molecule。共有ボードとマイ付箋で共通利用する付箋の見た目だけを担う。
export function StickyNote({
  noteId,
  isLifted = false,
  isSelected = false,
  color = "yellow",
  children,
  className,
  style,
  testId,
  "data-editing": dataEditing,
}: StickyNoteProps) {
  return (
    <div
      data-slot="sticky-note"
      data-testid={testId}
      data-selected={isSelected || undefined}
      data-editing={dataEditing || undefined}
      className={cn(
        "isolate flex flex-col overflow-hidden rounded-[2px]",
        COLOR_CLASSES[color],
        isSelected
          ? "outline-2 outline-blue-500 dark:outline-blue-400"
          : "outline-none",
        className,
      )}
      style={{
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        boxShadow: getNoteShadow(noteId, { isLifted }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
