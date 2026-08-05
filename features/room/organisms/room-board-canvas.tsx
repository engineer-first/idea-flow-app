"use client";

// ボード面。カメラで移動・拡大縮小する世界レイヤーに共有付箋・グループ枠・
// ドラッグ中のゴーストを描き、下端にマイ付箋ドックを重ねる。
// ドラッグの状態機械は持たない（logic/use-board-drag が view で束ねる）。
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  RefObject,
} from "react";
import { NOTE_WIDTH } from "@/contracts/board";
import {
  calculateRenderGroups,
  type PersistentGroup,
} from "@/contracts/grouping";
import {
  isAtOrAfterGroupingStep,
  isResultStep,
  type RoomPhase,
} from "@/contracts/phase";
import type { DotVoteKind } from "@/contracts/room-protocol";
import type { DotVoteRemaining } from "@/features/dot-vote";
import {
  HmwDecidedIssueBanner,
  HmwTemplatePanel,
  isHmwWritingStep,
} from "@/features/hmw";
import { IdeaSupportSidebar } from "@/features/idea-support";
import {
  type Note,
  NoteCard,
  NoteGroupCard,
  PrivateNotesToolbar,
  StickyNote,
} from "@/features/notes";
import { cn } from "@/lib/utils";
import type { CanvasCamera } from "../logic/canvas-camera";
import type { Decision } from "../logic/room-reducer";
import { CanvasZoomControls } from "../molecules/canvas-zoom-controls";
import {
  DECIDE_NOTE_ACTION_INSET,
  DECIDE_NOTE_ACTION_SIZE,
  DecideNoteAction,
} from "../molecules/decide-note-action";

export type RoomBoardCanvasProps = {
  notes: Note[];
  groups: PersistentGroup[];
  phase: RoomPhase;
  decision: Decision | null;
  isHost: boolean;
  privateNotes: Note[];
  selectedNoteId: string | null;
  draggingNoteId: string | null;
  isDisconnected: boolean;
  voteRemaining: DotVoteRemaining;
  // ツールバー発ドラッグ中に、まだ notes に現れていない付箋を描くゴースト。
  dragGhost: { note: Note; x: number; y: number } | null;
  isReturnDropTarget: boolean;
  // 前フェーズから持ち越した決定課題。null なら非表示。
  hmwDecidedIssue: string | null;
  boardScrollerRef: RefObject<HTMLDivElement | null>;
  privateToolbarRef: RefObject<HTMLDivElement | null>;
  camera: CanvasCamera;
  gridStyle: CSSProperties;
  isPanning: boolean;
  onCanvasPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToNotes: () => void;
  onSelect: (noteId: string | null) => void;
  onHmwTemplateSelect: (content: string) => void;
  onNoteDragStart: (
    noteId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onNoteContentChange: (noteId: string, content: string) => void;
  onNoteDelete: (noteId: string) => void;
  onNoteVote: (noteId: string, kind: DotVoteKind) => void;
  onNoteVoteReset: (noteId: string, kind: DotVoteKind) => void;
  onNoteDecide: (noteId: string) => void;
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
  decision,
  isHost,
  privateNotes,
  selectedNoteId,
  draggingNoteId,
  isDisconnected,
  voteRemaining,
  dragGhost,
  isReturnDropTarget,
  hmwDecidedIssue,
  boardScrollerRef,
  privateToolbarRef,
  camera,
  gridStyle,
  isPanning,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerEnd,
  onCanvasWheel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToNotes,
  onSelect,
  onHmwTemplateSelect,
  onNoteDragStart,
  onNoteContentChange,
  onNoteDelete,
  onNoteVote,
  onNoteVoteReset,
  onNoteDecide,
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
  const selectedNote = notes.find((note) => note.id === selectedNoteId);
  const canDecide = Boolean(
    selectedNote &&
      isHost &&
      !isDisconnected &&
      isResultStep(phase) &&
      decision?.noteId !== selectedNote.id,
  );

  function handleBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // 付箋の上のpointerdownはバブリングしてくるので、ボード背景を
    // 直接押したときだけ選択を解除する。
    if (
      event.button === 0 &&
      (event.target === event.currentTarget ||
        (event.target as HTMLElement).dataset.canvasBackground === "true")
    ) {
      onSelect(null);
    }
  }

  function handleViewportPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    handleBoardPointerDown(event);
    onCanvasPointerDown(event);
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
          className={`relative h-full overflow-hidden bg-muted/20 ${
            isPanning ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={gridStyle}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerEnd}
          onPointerCancel={onCanvasPointerEnd}
          onWheel={onCanvasWheel}
        >
          <div
            data-testid="board-canvas"
            data-canvas-background="true"
            className="absolute top-0 left-0 min-h-full min-w-full"
            style={{
              transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
              transformOrigin: "0 0",
              willChange: "transform",
            }}
          >
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
                editingDisabled={isResultStep(phase)}
                isDecided={decision?.noteId === note.id}
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
            {canDecide && selectedNote ? (
              <DecideNoteAction
                x={
                  selectedNote.x +
                  NOTE_WIDTH -
                  DECIDE_NOTE_ACTION_SIZE -
                  DECIDE_NOTE_ACTION_INSET
                }
                y={selectedNote.y + DECIDE_NOTE_ACTION_INSET}
                onDecide={() => onNoteDecide(selectedNote.id)}
              />
            ) : null}
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
          className="pointer-events-none absolute bottom-3 left-3 z-40"
          data-testid="canvas-zoom-hud"
        >
          <CanvasZoomControls
            zoom={camera.zoom}
            onZoomOut={onZoomOut}
            onResetZoom={onResetZoom}
            onZoomIn={onZoomIn}
            onFitToNotes={onFitToNotes}
          />
        </div>
        {/* バナー（top）とパネル（left）は別条件で出す: Step 2-2 以降は
            テンプレートを出さないが、決定課題の掲示は続ける（#165 で再利用）。 */}
        {hmwDecidedIssue !== null ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-3 top-3 z-30 flex justify-center",
              // テンプレートパネル（left-3 + w-64）と重なる帯を、
              // パネル表示中はバナー側の左余白として予約する。
              isHmwWritingStep(phase) && "left-72",
            )}
          >
            {/* 長文でも左端のテンプレートパネルと同じ帯を侵食しないよう
                幅を抑える（本文は省略せず折り返して全文表示する）。 */}
            <HmwDecidedIssueBanner
              content={hmwDecidedIssue}
              className="pointer-events-auto max-w-xl"
            />
          </div>
        ) : null}
        {isHmwWritingStep(phase) ? (
          // 下端はマイ付箋ドック（h-48 + 余白）を避ける。ボードが縦に狭い
          // 画面ではパネル内スクロールに逃がす（#198 の全画面化で緩和される）。
          <div className="pointer-events-none absolute top-16 bottom-56 left-3 z-30 flex items-start">
            <HmwTemplatePanel
              className="pointer-events-auto max-h-full overflow-y-auto"
              onTemplateSelect={onHmwTemplateSelect}
              disabled={isDisconnected}
            />
          </div>
        ) : null}
        <div
          className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex justify-center"
          data-testid="private-notes-dock"
        >
          <PrivateNotesToolbar
            notes={privateNotes}
            disabled={isDisconnected}
            editingDisabled={isResultStep(phase)}
            className="pointer-events-auto w-[min(42rem,calc(100vw-2rem))] max-w-none"
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
        <div
          className="pointer-events-none absolute top-16 right-3 bottom-3 z-30"
          data-testid="idea-support-dock"
        >
          <IdeaSupportSidebar />
        </div>
      </div>
    </div>
  );
}
