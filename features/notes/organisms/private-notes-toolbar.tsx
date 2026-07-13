"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Note } from "../logic/notes-reducer";
import { NoteCard } from "../molecules/note-card";

export type PrivateNotesToolbarProps = {
  notes: Note[];
  disabled: boolean;
  className?: string;
  toolbarRef?: React.RefObject<HTMLDivElement | null>;
  isReturnDropTarget?: boolean;
  selectedNoteId: string | null;
  onSelect: (noteId: string | null) => void;
  onAdd: () => void;
  onContentChange: (noteId: string, content: string) => void;
  onDelete: (noteId: string) => void;
  onDragStart: (
    noteId: string,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
};

export function PrivateNotesToolbar({
  notes,
  disabled,
  className,
  toolbarRef,
  isReturnDropTarget = false,
  selectedNoteId,
  onSelect,
  onAdd,
  onContentChange,
  onDelete,
  onDragStart,
}: PrivateNotesToolbarProps) {
  return (
    <Card
      ref={toolbarRef}
      className={cn("flex h-48 w-full flex-row overflow-hidden", className)}
      data-testid="private-notes-toolbar"
      data-return-drop-target={isReturnDropTarget || undefined}
    >
      <CardHeader className="w-36 shrink-0 justify-center border-r border-border p-3">
        <CardTitle className="text-base">マイ付箋</CardTitle>
        <Button type="button" size="sm" disabled={disabled} onClick={onAdd}>
          <Plus aria-hidden="true" />
          付箋を追加
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 flex-1 p-3">
        <div
          className="h-full overflow-x-auto"
          data-testid="private-notes-scroll"
        >
          <div
            className="flex h-full min-w-max flex-nowrap items-center gap-3"
            data-testid="private-notes-list"
          >
            {notes.length === 0 ? (
              <p className="flex h-full min-w-48 items-center text-sm text-muted-foreground">
                個人付箋はまだありません
              </p>
            ) : null}
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isOwnDrag={false}
                isSelected={selectedNoteId === note.id}
                disabled={disabled}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onContentChange={onContentChange}
                onDelete={onDelete}
                voteRemaining={{ subjective: 0, objective: 0 }}
                onVote={() => {}}
                onVoteReset={() => {}}
                hideVoteControls={true}
                className="relative shrink-0"
                style={{ width: "200px", height: "150px" }}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
