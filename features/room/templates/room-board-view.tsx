"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// ルームボードの表示用コンポーネント。データ層には一切依存せず、
// 付箋の配列と各種コールバックをpropsで受け取る。
// WebSocket接続・スロットル・プロトコル送信はroom-board.tsx（コンテナ）の責務。
// 「どの付箋を選択中か」は同期不要な純粋にUIの関心事なので、ここでローカルに持つ。
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/contracts/board";
import {
  calculateRenderGroups,
  type PersistentGroup,
} from "@/contracts/grouping";
import {
  DOT_VOTE_LIMITS,
  type DotVoteKind,
  type Phase,
  type TimerState,
} from "@/contracts/room-protocol";
import { DotVoteSummary } from "@/features/dot-vote";
import { CopyInviteButton } from "@/features/invite";
import {
  type Note,
  NoteCard,
  NoteGroupCard,
  PrivateNotesToolbar,
  StickyNote,
} from "@/features/notes";
import { RoomMembers } from "@/features/room-members";
import { VoteTotalingPanel } from "@/features/vote-totaling";
import {
  CONNECTION_STATUS_LABELS,
  type RoomScreenConnectionStatus,
} from "../logic/connection-status";
import type { Member } from "../logic/room-reducer";
import { LeaveConfirmDialog } from "../molecules/leave-confirm-dialog";
import { RoomTimer } from "../organisms/room-timer";

const PHASE_LABELS: Record<Phase, string> = {
  lobby: "開始待ち",
  phase1: "フェーズ1",
  phase2: "フェーズ2",
  phase3: "フェーズ3",
  phase4: "フェーズ4（投票結果）",
};

export type RoomBoardViewProps = {
  notes: Note[];
  groups: PersistentGroup[];
  inviteCode: string;
  inviteUrl: string;
  phase: Phase;
  timer: TimerState;
  timerServerOffsetMs: number;
  isHost: boolean;
  // WebSocket 接続の表示用状態。値の生成は room-board（コンテナ）の責務で、
  // ここでは受け取った状態を表示するだけ（このコンポーネントはデータ層に依存しない）。
  connectionStatus: RoomScreenConnectionStatus;
  draggingNoteId: string | null;
  members: Member[];
  currentUserId: string;
  // ホストの userId（メンバー一覧の「ホスト」ラベル表示用）。
  hostUserId: string;
  isNextPhasePending: boolean;
  privateNotes: Note[];
  onAddPrivateNote: () => void;
  onPrivateNoteContentChange: (noteId: string, content: string) => void;
  onPrivateNoteDelete: (noteId: string) => void;
  onPrivateNotePublish: (noteId: string, x: number, y: number) => void;
  onPrivateNoteUnpublish: (noteId: string) => void;
  onNoteDragStart: (noteId: string) => void;
  onNoteDragMove: (noteId: string, x: number, y: number) => void;
  onNoteDragEnd: (noteId: string, x: number, y: number) => void;
  onNoteContentChange: (noteId: string, content: string) => void;
  onNoteDelete: (noteId: string) => void;
  onGroupCreate?: (name: string, noteIds: string[]) => void;
  onGroupUpdateName?: (groupId: string, name: string) => void;
  onNoteVote: (noteId: string, kind: DotVoteKind) => void;
  onNoteVoteReset: (noteId: string, kind: DotVoteKind) => void;
  // 退出。
  onLeave: () => void;
  // 退出処理中（多重押下防止）。true の間「退出する」ボタンは disabled。
  isLeaving: boolean;
  // 次フェーズへ。ホストのみ UI 表示。
  onNextPhase: () => void;
  onTimerStart: (durationMs: number) => void;
  onTimerPause: () => void;
  onTimerResume: () => void;
  onTimerExtend: () => void;
  onTimerStop: () => void;
};

export function RoomBoardView({
  notes,
  groups,
  inviteCode,
  inviteUrl,
  phase,
  timer,
  timerServerOffsetMs,
  isHost,
  connectionStatus,
  draggingNoteId,
  members,
  currentUserId,
  hostUserId,
  isNextPhasePending,
  privateNotes,
  onAddPrivateNote,
  onPrivateNoteContentChange,
  onPrivateNoteDelete,
  onPrivateNotePublish,
  onPrivateNoteUnpublish,
  onNoteDragStart,
  onNoteDragMove,
  onNoteDragEnd,
  onNoteContentChange,
  onNoteDelete,
  onGroupCreate,
  onGroupUpdateName,
  onNoteVote,
  onNoteVoteReset,
  onLeave,
  isLeaving,
  onNextPhase,
  onTimerStart,
  onTimerPause,
  onTimerResume,
  onTimerExtend,
  onTimerStop,
}: RoomBoardViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [voteTotalingDialogOpen, setVoteTotalingDialogOpen] = useState(false);
  const boardRootRef = useRef<HTMLDivElement>(null);
  const boardScrollerRef = useRef<HTMLDivElement>(null);
  const privateToolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarDrag, setToolbarDrag] = useState<{
    note: Note;
    pointerId: number;
    status: "private" | "shared" | "returning";
    x: number;
    y: number;
  } | null>(null);
  const toolbarDragRef = useRef<typeof toolbarDrag>(null);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setVoteTotalingDialogOpen(phase === "phase4");
  }, [phase]);

  // ハイドレーション直後の高速接続確立によるMismatchedを防ぐため、マウント完了までは接続中（非活性）扱いにする
  const isDisconnected = isMounted ? connectionStatus !== "open" : true;

  // 非公開へ戻す操作は RoomDO の応答で確定する。ただしドラッグ中は応答を
  // 待たずに、カードをポインターのある領域へ表示し直す。
  const renderedNotes =
    toolbarDrag?.status === "returning"
      ? notes.filter((note) => note.id !== toolbarDrag.note.id)
      : notes;
  const renderedPrivateNotes =
    toolbarDrag?.status === "returning" &&
    !privateNotes.some((note) => note.id === toolbarDrag.note.id)
      ? [
          { ...toolbarDrag.note, visibility: "private" as const },
          ...privateNotes,
        ]
      : privateNotes;
  const renderGroups = calculateRenderGroups(renderedNotes, groups);
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

  const isPointerOverPrivateToolbar = useCallback(
    (clientX: number, clientY: number) => {
      const rect = privateToolbarRef.current?.getBoundingClientRect();
      return (
        rect !== undefined &&
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    },
    [],
  );

  const handleSharedNoteDragStart = useCallback(
    (noteId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      boardRootRef.current?.setPointerCapture?.(event.pointerId);
      const drag = {
        note,
        pointerId: event.pointerId,
        status: "shared" as const,
        x: note.x,
        y: note.y,
      };
      toolbarDragRef.current = drag;
      setToolbarDrag(drag);
      onNoteDragStart(noteId);
    },
    [notes, onNoteDragStart],
  );

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

  function boardPositionFromPointer(clientX: number, clientY: number) {
    const scroller = boardScrollerRef.current;
    if (!scroller) return null;
    const rect = scroller.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    return {
      x: Math.min(
        Math.max(clientX - rect.left + scroller.scrollLeft, 0),
        BOARD_WIDTH,
      ),
      y: Math.min(
        Math.max(clientY - rect.top + scroller.scrollTop, 0),
        BOARD_HEIGHT,
      ),
    };
  }

  const handlePrivateDragStart = useCallback(
    (noteId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      const note = privateNotes.find((n) => n.id === noteId);
      if (!note) return;
      boardRootRef.current?.setPointerCapture?.(event.pointerId);
      const drag = {
        note,
        pointerId: event.pointerId,
        status: "private" as const,
        x: note.x,
        y: note.y,
      };
      toolbarDragRef.current = drag;
      setToolbarDrag(drag);
    },
    [privateNotes],
  );

  function handlePrivateDragMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = toolbarDragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;

    const isOverToolbar = isPointerOverPrivateToolbar(
      event.clientX,
      event.clientY,
    );

    if (isOverToolbar) {
      if (
        current.status === "shared" &&
        current.note.authorId === currentUserId
      ) {
        onPrivateNoteUnpublish(current.note.id);
        const next = { ...current, status: "returning" as const };
        toolbarDragRef.current = next;
        setToolbarDrag(next);
      }
      return;
    }

    const position = boardPositionFromPointer(event.clientX, event.clientY);
    if (!position) return;
    if (current.status === "private" || current.status === "returning") {
      // ボードに入った瞬間に共有化する。以後の座標は既存のdrag配信を使う。
      onPrivateNotePublish(current.note.id, position.x, position.y);
      onNoteDragStart(current.note.id);
    }
    // publish と同じ WebSocket 接続で送るため、publish のあとに届く drag は
    // RoomDO 側でも公開後の付箋として処理される。
    onNoteDragMove(current.note.id, position.x, position.y);
    const next = { ...current, status: "shared" as const, ...position };
    toolbarDragRef.current = next;
    setToolbarDrag(next);
  }

  function handlePrivateDragEnd(event: React.PointerEvent<HTMLDivElement>) {
    const current = toolbarDragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const position = boardPositionFromPointer(event.clientX, event.clientY);
    if (current.status === "shared") {
      const finalPosition = position ?? { x: current.x, y: current.y };
      onNoteDragEnd(current.note.id, finalPosition.x, finalPosition.y);
    }
    boardRootRef.current?.releasePointerCapture?.(event.pointerId);
    toolbarDragRef.current = null;
    setToolbarDrag(null);
  }

  return (
    <div
      ref={boardRootRef}
      data-testid="room-board-view-root"
      className="flex h-full flex-col gap-3"
      onPointerMove={handlePrivateDragMove}
      onPointerUp={handlePrivateDragEnd}
      onPointerCancel={handlePrivateDragEnd}
    >
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
                <span className="text-xs text-muted-foreground">
                  招待コード
                </span>
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
          />
          <DotVoteSummary voteRemaining={voteRemaining} />
          <span className="text-sm text-muted-foreground">
            Phase:
            <span className="ml-1 font-semibold text-foreground">
              {PHASE_LABELS[phase]}
            </span>
          </span>

          {isHost && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  disabled={
                    isDisconnected || isNextPhasePending || phase === "phase4"
                  }
                >
                  次のフェーズへ
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    次のフェーズへ移行しますか？
                  </AlertDialogTitle>

                  <AlertDialogDescription>
                    {PHASE_LABELS[phase]}
                    から次のフェーズへ移行します。
                    移行すると現在の付箋が整理され、一部の内容が引き継がれない場合があります。
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>

                  <AlertDialogAction onClick={onNextPhase}>
                    移行する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
          {phase === "phase4" ? (
            <Button
              type="button"
              onClick={() => setVoteTotalingDialogOpen(true)}
            >
              投票結果を表示
            </Button>
          ) : null}
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
          <RoomTimer
            timer={timer}
            serverOffsetMs={timerServerOffsetMs}
            isHost={isHost}
            disabled={isDisconnected}
            onStart={onTimerStart}
            onPause={onTimerPause}
            onResume={onTimerResume}
            onExtend={onTimerExtend}
            onStop={onTimerStop}
          />
        </div>
      </div>

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
              {renderedNotes.length === 0 ? (
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

              {renderedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isOwnDrag={draggingNoteId === note.id}
                  isSelected={selectedNoteId === note.id}
                  disabled={isDisconnected}
                  onSelect={setSelectedNoteId}
                  onDragStart={handleSharedNoteDragStart}
                  onContentChange={onNoteContentChange}
                  onDelete={handleNoteDelete}
                  voteRemaining={voteRemaining}
                  onVote={onNoteVote}
                  onVoteReset={onNoteVoteReset}
                />
              ))}
              {toolbarDrag?.status === "shared" &&
              !notes.some((note) => note.id === toolbarDrag.note.id) ? (
                <StickyNote
                  noteId={toolbarDrag.note.id}
                  isLifted
                  color={toolbarDrag.note.color}
                  className="pointer-events-none absolute"
                  style={{ left: toolbarDrag.x, top: toolbarDrag.y }}
                >
                  <p className="min-h-0 flex-1 overflow-hidden p-2 text-sm text-slate-900 dark:text-slate-50">
                    {toolbarDrag.note.content || "メモを入力..."}
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
              notes={renderedPrivateNotes.filter(
                (note) =>
                  !(
                    note.id === toolbarDrag?.note.id &&
                    toolbarDrag.status === "shared"
                  ) && note.id !== draggingNoteId,
              )}
              disabled={isDisconnected}
              className="pointer-events-auto max-w-5xl"
              toolbarRef={privateToolbarRef}
              isReturnDropTarget={
                toolbarDrag?.status === "shared" &&
                toolbarDrag.note.authorId === currentUserId
              }
              selectedNoteId={selectedNoteId}
              onSelect={setSelectedNoteId}
              onAdd={onAddPrivateNote}
              onContentChange={onPrivateNoteContentChange}
              onDelete={onPrivateNoteDelete}
              onDragStart={handlePrivateDragStart}
            />
          </div>
        </div>
      </div>

      <Dialog
        open={voteTotalingDialogOpen}
        onOpenChange={setVoteTotalingDialogOpen}
      >
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>投票結果</DialogTitle>
            <DialogDescription>
              付箋ごとの投票結果を確認し、ボードに戻って話し合います。
            </DialogDescription>
          </DialogHeader>
          <VoteTotalingPanel
            isVotingComplete={phase === "phase4"}
            members={members}
            notes={notes}
          />
        </DialogContent>
      </Dialog>

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
