"use client";

// ルームボードのコンテナ（状態・副作用を持つ側）。
// 表示は BoardView / NoteCard に委譲し、ここでは
//   - Supabase Realtimeのプライベートチャンネル購読（DB由来の変更 + ドラッグ中イベント）
//   - ドラッグ中イベントのスロットル送信
//   - Server Actions呼び出しによる永続化
// を担当する。関心の分離のため、Supabaseやnotes-reducerへの依存はこのファイルに閉じ込める。
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { BoardView } from "@/app/rooms/[id]/board-view";
import {
  createNote,
  deleteNote,
  updateNoteContent,
  updateNotePosition,
} from "@/app/rooms/actions";
import { DRAG_BROADCAST_THROTTLE_MS } from "@/app/rooms/board-constants";
import {
  applyNoteEvent,
  type Note,
  type NoteRow,
  toNote,
} from "@/app/rooms/notes-reducer";
import { createThrottled } from "@/app/rooms/throttle";
import { createClient } from "@/lib/supabase/client";

export type RoomBoardProps = {
  roomId: string;
  inviteCode: string;
  initialNotes: Note[];
};

type NoteDragBroadcastPayload = { id: string; x: number; y: number };

// realtime.broadcast_changes() が積むペイロード形状。
// { old_record, record, operation, table, schema } の実体はDB側トリガーの実装に依存する
// （supabase/migrations の notes_broadcast_changes トリガー関数を参照）。
type ChangePayload = {
  record: NoteRow | null;
  old_record: NoteRow | null;
};

export function RoomBoard({
  roomId,
  inviteCode,
  initialNotes,
}: RoomBoardProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const draggingNoteIdRef = useRef<string | null>(null);
  const supabaseRef = useRef(createClient());
  const sendDragRef = useRef<ReturnType<
    typeof createThrottled<[NoteDragBroadcastPayload]>
  > | null>(null);

  useEffect(() => {
    draggingNoteIdRef.current = draggingNoteId;
  }, [draggingNoteId]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    function handleDbChange(operation: "INSERT" | "UPDATE" | "DELETE") {
      return ({ payload }: { payload: ChangePayload }) => {
        setNotes((current) => {
          if (operation === "DELETE") {
            if (!payload.old_record) return current;
            return applyNoteEvent(
              current,
              {
                operation: "DELETE",
                record: null,
                oldRecord: toNote(payload.old_record),
              },
              { draggingNoteId: draggingNoteIdRef.current },
            );
          }
          if (!payload.record) return current;
          return applyNoteEvent(
            current,
            {
              operation,
              record: toNote(payload.record),
              oldRecord: payload.old_record ? toNote(payload.old_record) : null,
            },
            { draggingNoteId: draggingNoteIdRef.current },
          );
        });
      };
    }

    function handleDrag({ payload }: { payload: NoteDragBroadcastPayload }) {
      setNotes((current) =>
        applyNoteEvent(
          current,
          { operation: "DRAG", noteId: payload.id, x: payload.x, y: payload.y },
          { draggingNoteId: draggingNoteIdRef.current },
        ),
      );
    }

    async function subscribe() {
      // プライベートチャンネルを購読する前に、現在のセッションのアクセストークンを
      // Realtimeソケットへ反映する。これを忘れるとrealtime.messagesのRLSが
      // 常に未認証として評価され、購読が拒否される。
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel = supabase.channel(`room:${roomId}`, {
        config: { private: true },
      });

      channel
        .on("broadcast", { event: "INSERT" }, handleDbChange("INSERT"))
        .on("broadcast", { event: "UPDATE" }, handleDbChange("UPDATE"))
        .on("broadcast", { event: "DELETE" }, handleDbChange("DELETE"))
        .on("broadcast", { event: "note-drag" }, handleDrag)
        .subscribe();

      sendDragRef.current = createThrottled(
        (payload: NoteDragBroadcastPayload) => {
          channel?.send({ type: "broadcast", event: "note-drag", payload });
        },
        DRAG_BROADCAST_THROTTLE_MS,
      );
    }

    subscribe();

    return () => {
      cancelled = true;
      sendDragRef.current?.cancel();
      sendDragRef.current = null;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [roomId]);

  const handleAddNote = useCallback(async () => {
    const result = await createNote(roomId);
    if (!result.ok) {
      console.error(result.error);
      return;
    }
    setNotes((current) =>
      applyNoteEvent(
        current,
        { operation: "INSERT", record: result.data, oldRecord: null },
        { draggingNoteId: draggingNoteIdRef.current },
      ),
    );
  }, [roomId]);

  const handleNoteDragStart = useCallback((noteId: string) => {
    setDraggingNoteId(noteId);
  }, []);

  const handleNoteDragMove = useCallback(
    (noteId: string, x: number, y: number) => {
      // 自分自身の操作なのでフィルタなし（draggingNoteId: null）で直接反映する。
      setNotes((current) =>
        applyNoteEvent(
          current,
          { operation: "DRAG", noteId, x, y },
          { draggingNoteId: null },
        ),
      );
      sendDragRef.current?.({ id: noteId, x, y });
    },
    [],
  );

  const handleNoteDragEnd = useCallback(
    async (noteId: string, x: number, y: number) => {
      sendDragRef.current?.cancel();
      setDraggingNoteId(null);
      setNotes((current) =>
        applyNoteEvent(
          current,
          { operation: "DRAG", noteId, x, y },
          { draggingNoteId: null },
        ),
      );

      const result = await updateNotePosition(noteId, x, y);
      if (!result.ok) {
        console.error(result.error);
      }
    },
    [],
  );

  const handleNoteContentChange = useCallback(
    async (noteId: string, content: string) => {
      setNotes((current) =>
        current.map((note) =>
          note.id === noteId ? { ...note, content } : note,
        ),
      );

      const result = await updateNoteContent(noteId, content);
      if (!result.ok) {
        console.error(result.error);
      }
    },
    [],
  );

  const handleNoteDelete = useCallback(async (noteId: string) => {
    setNotes((current) => current.filter((note) => note.id !== noteId));

    const result = await deleteNote(noteId);
    if (!result.ok) {
      console.error(result.error);
    }
  }, []);

  return (
    <BoardView
      notes={notes}
      inviteCode={inviteCode}
      draggingNoteId={draggingNoteId}
      onAddNote={handleAddNote}
      onNoteDragStart={handleNoteDragStart}
      onNoteDragMove={handleNoteDragMove}
      onNoteDragEnd={handleNoteDragEnd}
      onNoteContentChange={handleNoteContentChange}
      onNoteDelete={handleNoteDelete}
    />
  );
}
