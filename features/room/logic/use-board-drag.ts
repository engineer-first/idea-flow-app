"use client";

// マイ付箋ツールバーとボードをまたぐドラッグの状態機械。
// private（ツールバー内）→ shared（ボードに入った瞬間 publish）→
// returning（自分の共有付箋をツールバーへ戻す = unpublish 待ち）を管理する。
// RoomDO の応答を待たずに表示を確定させるため、renderedNotes /
// renderedPrivateNotes として「表示用に畳み込んだ」配列を返す。
// DOM 参照は rect と scroll 位置の読み取りだけに限定し、JSX は持たない。
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/contracts/board";
import type { Note } from "@/features/notes";

export type BoardDrag = {
  note: Note;
  pointerId: number;
  status: "private" | "shared" | "returning";
  x: number;
  y: number;
};

export type UseBoardDragArgs = {
  notes: Note[];
  privateNotes: Note[];
  currentUserId: string;
  boardRootRef: RefObject<HTMLDivElement | null>;
  boardScrollerRef: RefObject<HTMLDivElement | null>;
  privateToolbarRef: RefObject<HTMLDivElement | null>;
  canPublish?: boolean;
  onPublishBlocked?: () => void;
  onNoteDragStart: (noteId: string) => void;
  onNoteDragMove: (noteId: string, x: number, y: number) => void;
  onNoteDragEnd: (noteId: string, x: number, y: number) => void;
  onPrivateNotePublish: (noteId: string, x: number, y: number) => void;
  onPrivateNoteUnpublish: (noteId: string) => void;
};

export function useBoardDrag({
  notes,
  privateNotes,
  currentUserId,
  boardRootRef,
  boardScrollerRef,
  privateToolbarRef,
  canPublish = true,
  onPublishBlocked,
  onNoteDragStart,
  onNoteDragMove,
  onNoteDragEnd,
  onPrivateNotePublish,
  onPrivateNoteUnpublish,
}: UseBoardDragArgs) {
  const [drag, setDrag] = useState<BoardDrag | null>(null);
  // pointermove は React の再レンダーより速く連続発火するため、最新状態は
  // ref で参照する（state はレンダー反映用）。
  const dragRef = useRef<BoardDrag | null>(null);
  const hasNotifiedBlockedRef = useRef(false);

  const updateDrag = useCallback((next: BoardDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  // 非公開へ戻す操作は RoomDO の応答で確定する。ただしドラッグ中は応答を
  // 待たずに、カードをポインターのある領域へ表示し直す。
  const renderedNotes =
    drag?.status === "returning"
      ? notes.filter((note) => note.id !== drag.note.id)
      : notes;
  const renderedPrivateNotes =
    drag?.status === "returning" &&
    !privateNotes.some((note) => note.id === drag.note.id)
      ? [{ ...drag.note, visibility: "private" as const }, ...privateNotes]
      : privateNotes;

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
    [privateToolbarRef],
  );

  const boardPositionFromPointer = useCallback(
    (clientX: number, clientY: number) => {
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
    },
    [boardScrollerRef],
  );

  const handleSharedNoteDragStart = useCallback(
    (noteId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      hasNotifiedBlockedRef.current = false;
      boardRootRef.current?.setPointerCapture?.(event.pointerId);
      updateDrag({
        note,
        pointerId: event.pointerId,
        status: "shared",
        x: note.x,
        y: note.y,
      });
      onNoteDragStart(noteId);
    },
    [notes, boardRootRef, onNoteDragStart, updateDrag],
  );

  const handlePrivateDragStart = useCallback(
    (noteId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      const note = privateNotes.find((n) => n.id === noteId);
      if (!note) return;
      hasNotifiedBlockedRef.current = false;
      boardRootRef.current?.setPointerCapture?.(event.pointerId);
      updateDrag({
        note,
        pointerId: event.pointerId,
        status: "private",
        x: note.x,
        y: note.y,
      });
    },
    [privateNotes, boardRootRef, updateDrag],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;

      if (isPointerOverPrivateToolbar(event.clientX, event.clientY)) {
        if (
          current.status === "shared" &&
          current.note.authorId === currentUserId
        ) {
          if (canPublish) {
            onPrivateNoteUnpublish(current.note.id);
          }
          updateDrag({ ...current, status: "returning" });
        }
        return;
      }

      const position = boardPositionFromPointer(event.clientX, event.clientY);
      if (!position) return;
      if (current.status === "private" || current.status === "returning") {
        if (!canPublish) {
          if (!hasNotifiedBlockedRef.current) {
            onPublishBlocked?.();
            hasNotifiedBlockedRef.current = true;
          }
        } else {
          // ボードに入った瞬間に共有化する。以後の座標は既存のdrag配信を使う。
          onPrivateNotePublish(current.note.id, position.x, position.y);
          onNoteDragStart(current.note.id);
        }
      }
      if (canPublish) {
        // publish と同じ WebSocket 接続で送るため、publish のあとに届く drag は
        // RoomDO 側でも公開後の付箋として処理される。
        onNoteDragMove(current.note.id, position.x, position.y);
      }
      updateDrag({ ...current, status: "shared", ...position });
    },
    [
      boardPositionFromPointer,
      canPublish,
      currentUserId,
      isPointerOverPrivateToolbar,
      onNoteDragMove,
      onNoteDragStart,
      onPrivateNotePublish,
      onPrivateNoteUnpublish,
      onPublishBlocked,
      updateDrag,
    ],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      hasNotifiedBlockedRef.current = false;
      if (current.status === "shared" && canPublish) {
        const position = boardPositionFromPointer(
          event.clientX,
          event.clientY,
        ) ?? { x: current.x, y: current.y };
        onNoteDragEnd(current.note.id, position.x, position.y);
      }
      boardRootRef.current?.releasePointerCapture?.(event.pointerId);
      updateDrag(null);
    },
    [
      boardPositionFromPointer,
      boardRootRef,
      canPublish,
      onNoteDragEnd,
      updateDrag,
    ],
  );

  return {
    drag,
    renderedNotes,
    renderedPrivateNotes,
    handleSharedNoteDragStart,
    handlePrivateDragStart,
    handlePointerMove,
    handlePointerEnd,
  };
}
