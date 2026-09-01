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
  useEffect,
  useRef,
  useState,
} from "react";
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/contracts/board";
import type { Note } from "@/features/notes";

/**
 * ドラッグ中の付箋の状態と位置情報を保持する型。
 */
export type BoardDrag = {
  note: Note;
  pointerId: number;
  status: "private" | "shared" | "returning";
  privateDropIndex: number | null;
  x: number;
  y: number;
  grabOffsetX: number;
  grabOffsetY: number;
};

/**
 * useBoardDrag フックに引き渡す引数オプションの型。
 */
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

/**
 * ポインターイベントから、掴んだ付箋要素内の相対位置（グラブオフセット）を算出します。
 *
 * @param event - ポインターダウン/移動イベント
 * @returns 付箋左上からの相対X/Yオフセット
 */
function getGrabOffset(event: ReactPointerEvent<HTMLButtonElement>) {
  if (
    !event.currentTarget ||
    typeof event.currentTarget.getBoundingClientRect !== "function"
  ) {
    return { grabOffsetX: 0, grabOffsetY: 0 };
  }
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return { grabOffsetX: 0, grabOffsetY: 0 };
  }
  return {
    grabOffsetX: Math.max(0, event.clientX - rect.left),
    grabOffsetY: Math.max(0, event.clientY - rect.top),
  };
}

function applyPrivateOrder(source: Note[], order: string[]) {
  const noteById = new Map(source.map((note) => [note.id, note]));
  const ordered = order.flatMap((noteId) => {
    const note = noteById.get(noteId);
    if (!note) return [];
    noteById.delete(noteId);
    return [note];
  });
  return [...ordered, ...noteById.values()];
}

function placePrivateNote(source: Note[], noteId: string, index: number) {
  const note = source.find((candidate) => candidate.id === noteId);
  if (!note) return source;
  const withoutNote = source.filter((candidate) => candidate.id !== noteId);
  const next = [...withoutNote];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, note);
  return next;
}

/**
 * ホワイトボードとマイ付箋ツールバー間の付箋ドラッグ状態を管理するカスタムフックです。
 *
 * @param args - フック設定オプション
 * @returns ドラッグ状態とポインターハンドラー
 */

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
  const [privateOrder, setPrivateOrder] = useState<string[]>([]);
  const [pendingReturnedNotes, setPendingReturnedNotes] = useState<
    Record<string, Note>
  >({});
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
  const privateNotesWithPending = [
    ...privateNotes,
    ...Object.values(pendingReturnedNotes).filter(
      (pending) => !privateNotes.some((note) => note.id === pending.id),
    ),
  ];
  const privateNotesWithReturning =
    drag?.status === "returning" &&
    !privateNotesWithPending.some((note) => note.id === drag.note.id)
      ? [
          { ...drag.note, visibility: "private" as const },
          ...privateNotesWithPending,
        ]
      : privateNotesWithPending;
  let renderedPrivateNotes = applyPrivateOrder(
    privateNotesWithReturning,
    privateOrder,
  );
  if (
    (drag?.status === "private" || drag?.status === "returning") &&
    drag.privateDropIndex !== null
  ) {
    renderedPrivateNotes = placePrivateNote(
      renderedPrivateNotes,
      drag.note.id,
      drag.privateDropIndex,
    );
  }

  useEffect(() => {
    setPendingReturnedNotes((pending) => {
      const confirmedIds = new Set(privateNotes.map((note) => note.id));
      const next = Object.fromEntries(
        Object.entries(pending).filter(([noteId]) => !confirmedIds.has(noteId)),
      );
      return Object.keys(next).length === Object.keys(pending).length
        ? pending
        : next;
    });
  }, [privateNotes]);

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
    (clientX: number, clientY: number, grabOffsetX = 0, grabOffsetY = 0) => {
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
          Math.max(clientX - grabOffsetX - rect.left + scroller.scrollLeft, 0),
          BOARD_WIDTH,
        ),
        y: Math.min(
          Math.max(clientY - grabOffsetY - rect.top + scroller.scrollTop, 0),
          BOARD_HEIGHT,
        ),
      };
    },
    [boardScrollerRef],
  );

  const privateDropIndexFromPointer = useCallback(
    (clientX: number, draggingNoteId: string) => {
      const toolbar = privateToolbarRef.current;
      const noteElements = toolbar?.querySelectorAll
        ? Array.from(
            toolbar.querySelectorAll<HTMLElement>(
              "[data-testid='note-card'][data-note-id]",
            ),
          ).filter((element) => element.dataset.noteId !== draggingNoteId)
        : [];
      if (noteElements.length > 0) {
        const index = noteElements.findIndex((element) => {
          const rect = element.getBoundingClientRect();
          return clientX < rect.left + rect.width / 2;
        });
        return index === -1 ? noteElements.length : index;
      }

      const rect = toolbar?.getBoundingClientRect();
      if (!rect) return 0;
      const width = Math.max(rect.right - rect.left, 1);
      return Math.min(
        privateNotes.length,
        Math.max(
          0,
          Math.round(((clientX - rect.left) / width) * privateNotes.length),
        ),
      );
    },
    [privateNotes.length, privateToolbarRef],
  );

  const handleSharedNoteDragStart = useCallback(
    (noteId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      hasNotifiedBlockedRef.current = false;
      boardRootRef.current?.setPointerCapture?.(event.pointerId);
      const { grabOffsetX, grabOffsetY } = getGrabOffset(event);
      updateDrag({
        note,
        pointerId: event.pointerId,
        status: "shared",
        privateDropIndex: null,
        x: note.x,
        y: note.y,
        grabOffsetX,
        grabOffsetY,
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
      const { grabOffsetX, grabOffsetY } = getGrabOffset(event);
      updateDrag({
        note,
        pointerId: event.pointerId,
        status: "private",
        privateDropIndex: privateNotes.findIndex(
          (candidate) => candidate.id === noteId,
        ),
        x: note.x,
        y: note.y,
        grabOffsetX,
        grabOffsetY,
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
          onPrivateNoteUnpublish(current.note.id);
          updateDrag({
            ...current,
            status: "returning",
            privateDropIndex: privateDropIndexFromPointer(
              event.clientX,
              current.note.id,
            ),
          });
        } else if (current.status === "private") {
          updateDrag({
            ...current,
            privateDropIndex: privateDropIndexFromPointer(
              event.clientX,
              current.note.id,
            ),
          });
        }
        return;
      }

      const position = boardPositionFromPointer(
        event.clientX,
        event.clientY,
        current.grabOffsetX,
        current.grabOffsetY,
      );
      if (!position) return;
      if (current.status === "private" || current.status === "returning") {
        if (!canPublish) {
          if (!hasNotifiedBlockedRef.current) {
            onPublishBlocked?.();
            hasNotifiedBlockedRef.current = true;
          }
          updateDrag({ ...current, status: "shared", ...position });
          return;
        }
        // ボードに入った瞬間に共有化する。以後の座標は既存のdrag配信を使う。
        onPrivateNotePublish(current.note.id, position.x, position.y);
        onNoteDragStart(current.note.id);
      } else if (!canPublish) {
        updateDrag({ ...current, status: "shared", ...position });
        return;
      }
      // publish と同じ WebSocket 接続で送るため、publish のあとに届く drag は
      // RoomDO 側でも公開後の付箋として処理される。
      onNoteDragMove(current.note.id, position.x, position.y);
      updateDrag({ ...current, status: "shared", ...position });
    },
    [
      boardPositionFromPointer,
      canPublish,
      currentUserId,
      isPointerOverPrivateToolbar,
      privateDropIndexFromPointer,
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
      if (current.status === "shared") {
        const position = boardPositionFromPointer(
          event.clientX,
          event.clientY,
          current.grabOffsetX,
          current.grabOffsetY,
        ) ?? { x: current.x, y: current.y };
        onNoteDragEnd(current.note.id, position.x, position.y);
      } else if (current.privateDropIndex !== null) {
        const privateDropIndex = current.privateDropIndex;
        setPrivateOrder((order) =>
          placePrivateNote(
            applyPrivateOrder(
              current.status === "returning"
                ? [
                    ...privateNotes,
                    { ...current.note, visibility: "private" as const },
                  ]
                : privateNotes,
              order,
            ),
            current.note.id,
            privateDropIndex,
          ).map((note) => note.id),
        );
        if (current.status === "returning") {
          setPendingReturnedNotes((pending) => ({
            ...pending,
            [current.note.id]: {
              ...current.note,
              visibility: "private" as const,
            },
          }));
        }
      }
      boardRootRef.current?.releasePointerCapture?.(event.pointerId);
      updateDrag(null);
    },
    [
      boardPositionFromPointer,
      boardRootRef,
      onNoteDragEnd,
      privateNotes,
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
