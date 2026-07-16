"use client";

// ボード面。スクロールする無限風キャンバスに共有付箋・グループ枠・
// ドラッグ中のゴーストを描き、下端にマイ付箋ドックを重ねる。
// ドラッグの状態機械は持たない（logic/use-board-drag が view で束ねる）。
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/contracts/board";
import {
  calculateRenderGroups,
  type PersistentGroup,
} from "@/contracts/grouping";
import { isAtOrAfterGroupingStep, type RoomPhase } from "@/contracts/phase";
import type { DotVoteKind } from "@/contracts/room-protocol";
import type { DotVoteRemaining } from "@/features/dot-vote";
import { IdeaSupportSidebar } from "@/features/idea-support";
import {
  type Note,
  NoteCard,
  NoteGroupCard,
  PrivateNotesToolbar,
  StickyNote,
} from "@/features/notes";

export type RoomBoardCanvasProps = {
  notes: Note[];
  groups: PersistentGroup[];
  phase: RoomPhase;
  privateNotes: Note[];
  selectedNoteId: string | null;
  draggingNoteId: string | null;
  isDisconnected: boolean;
  voteRemaining: DotVoteRemaining;
  // ツールバー発ドラッグ中に、まだ notes に現れていない付箋を描くゴースト。
  dragGhost: { note: Note; x: number; y: number } | null;
  isReturnDropTarget: boolean;
  boardScrollerRef: RefObject<HTMLDivElement | null>;
  privateToolbarRef: RefObject<HTMLDivElement | null>;
  onSelect: (noteId: string | null) => void;
  onNoteDragStart: (
    noteId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onNoteContentChange: (noteId: string, content: string) => void;
  onNoteDelete: (noteId: string) => void;
  onNoteVote: (noteId: string, kind: DotVoteKind) => void;
  onNoteVoteReset: (noteId: string, kind: DotVoteKind) => void;
  onGroupCreate?: (name: string, noteIds: string[]) => void;
  onGroupUpdateName?: (groupId: string, name: string) => void;
  onAddPrivateNote: () => void;
  onPrivateNoteContentChange: (noteId: string, content: string) => void;
  onPrivateNoteDelete: (noteId: string) => void;
  onPrivateNoteDragStart: (
    noteId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
};

export function RoomBoardCanvas({
  notes,
  groups,
  phase,
  privateNotes,
  selectedNoteId,
  draggingNoteId,
  isDisconnected,
  voteRemaining,
  dragGhost,
  isReturnDropTarget,
  boardScrollerRef,
  privateToolbarRef,
  onSelect,
  onNoteDragStart,
  onNoteContentChange,
  onNoteDelete,
  onNoteVote,
  onNoteVoteReset,
  onGroupCreate,
  onGroupUpdateName,
  onAddPrivateNote,
  onPrivateNoteContentChange,
  onPrivateNoteDelete,
  onPrivateNoteDragStart,
}: RoomBoardCanvasProps) {
  const renderGroups = isAtOrAfterGroupingStep(phase)
    ? calculateRenderGroups(notes, groups)
    : [];

  function handleBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // 付箋の上のpointerdownはバブリングしてくるので、ボード背景を
    // 直接押したときだけ選択を解除する。
    if (event.target === event.currentTarget) {
      onSelect(null);
    }
  }

  function handleNoteDelete(noteId: string) {
    if (selectedNoteId === noteId) {
      onSelect(null);
    }
    onNoteDelete(noteId);
  }

  return (
    <div className="min-h-0 flex-1">
      <div className="relative h-full min-h-80" data-testid="board-frame">
        <div
          ref={boardScrollerRef}
          className="h-full overflow-auto rounded-md border border-border bg-muted/30"
        >
          <div
            data-testid="board-canvas"
            className="relative"
            style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
            onPointerDown={handleBoardPointerDown}
          >
            {notes.length === 0 ? (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                共有付箋はまだありません
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
                onSelect={onSelect}
                onDragStart={onNoteDragStart}
                onContentChange={onNoteContentChange}
                onDelete={handleNoteDelete}
                voteRemaining={voteRemaining}
                onVote={onNoteVote}
                onVoteReset={onNoteVoteReset}
              />
            ))}
            {dragGhost ? (
              <StickyNote
                noteId={dragGhost.note.id}
                isLifted
                color={dragGhost.note.color}
                className="pointer-events-none absolute"
                style={{ left: dragGhost.x, top: dragGhost.y }}
              >
                <p className="min-h-0 flex-1 overflow-hidden p-2 text-sm text-slate-900 dark:text-slate-50">
                  {dragGhost.note.content || "メモを入力..."}
                </p>
              </StickyNote>
            ) : null}
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex justify-center"
          data-testid="private-notes-dock"
        >
          <PrivateNotesToolbar
            notes={privateNotes}
            disabled={isDisconnected}
            className="pointer-events-auto max-w-5xl"
            toolbarRef={privateToolbarRef}
            isReturnDropTarget={isReturnDropTarget}
            selectedNoteId={selectedNoteId}
            onSelect={onSelect}
            onAdd={onAddPrivateNote}
            onContentChange={onPrivateNoteContentChange}
            onDelete={onPrivateNoteDelete}
            onDragStart={onPrivateNoteDragStart}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-3 right-3 z-30">
          <IdeaSupportSidebar />
        </div>
      </div>
    </div>
  );
}
