"use client";

// ルームボードのコンテナ（状態・副作用を持つ側）。
// 表示は BoardView / NoteCard に委譲し、ここでは
//   - RoomDO への WebSocket 接続（lib/room-client）とサーバーメッセージの適用
//   - ドラッグ中イベントのスロットル送信
//   - 操作のプロトコルメッセージ化（contracts/room-protocol.ts）
// を担当する。関心の分離のため、room-client や notes-reducer への依存はこのファイルに閉じ込める。
//
// 確定状態の真実はサーバー（RoomDO）側にあり、再接続時は snapshot で復元される。
// 削除は楽観更新しない: author 以外の削除はサーバーが forbidden で拒否するため、
// 確定（note:deleted）を待ってから消すことで「消えたのに戻る」揺れを避ける。
import { useCallback, useEffect, useRef, useState } from "react";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { DRAG_BROADCAST_THROTTLE_MS } from "@/app/rooms/board-constants";
import { applyNoteEvent, type Note } from "@/app/rooms/notes-reducer";
import { createThrottled } from "@/app/rooms/throttle";
import type { ServerMessage } from "@/contracts/room-protocol";
import {
  createRoomClient,
  type RoomClient,
  type RoomSocketFactory,
} from "@/lib/room-client/room-client";
import { roomWebSocketUrl } from "@/lib/room-client/ws-url";

export type RoomBoardProps = {
  roomId: string;
  inviteCode: string;
  inviteUrl: string;
  initialNotes: Note[];
  // テストからフェイク WebSocket を注入するための口。本番では未指定。
  webSocketFactory?: RoomSocketFactory;
};

type NoteDragPayload = { id: string; x: number; y: number };

export function RoomBoard({
  roomId,
  inviteCode,
  inviteUrl,
  initialNotes,
  webSocketFactory,
}: RoomBoardProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const draggingNoteIdRef = useRef<string | null>(null);
  const clientRef = useRef<RoomClient | null>(null);
  const sendDragRef = useRef<ReturnType<
    typeof createThrottled<[NoteDragPayload]>
  > | null>(null);

  useEffect(() => {
    draggingNoteIdRef.current = draggingNoteId;
  }, [draggingNoteId]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "snapshot": {
        // 接続・再接続時の一括復元。確定状態はサーバーが真実。
        setNotes(message.notes);
        return;
      }
      case "note:inserted": {
        setNotes((current) =>
          applyNoteEvent(
            current,
            { operation: "INSERT", record: message.note, oldRecord: null },
            { draggingNoteId: draggingNoteIdRef.current },
          ),
        );
        return;
      }
      case "note:updated": {
        setNotes((current) =>
          applyNoteEvent(
            current,
            { operation: "UPDATE", record: message.note, oldRecord: null },
            { draggingNoteId: draggingNoteIdRef.current },
          ),
        );
        return;
      }
      case "note:deleted": {
        setNotes((current) => {
          const oldRecord = current.find((note) => note.id === message.noteId);
          if (!oldRecord) return current;
          return applyNoteEvent(
            current,
            { operation: "DELETE", record: null, oldRecord },
            { draggingNoteId: draggingNoteIdRef.current },
          );
        });
        return;
      }
      case "note:drag": {
        setNotes((current) =>
          applyNoteEvent(
            current,
            {
              operation: "DRAG",
              noteId: message.noteId,
              x: message.x,
              y: message.y,
            },
            { draggingNoteId: draggingNoteIdRef.current },
          ),
        );
        return;
      }
      case "error": {
        console.error(`ルーム操作エラー (${message.code}): ${message.message}`);
        return;
      }
      default: {
        const _exhaustive: never = message;
        void _exhaustive;
        return;
      }
    }
  }, []);

  useEffect(() => {
    const client = createRoomClient({
      url: roomWebSocketUrl(roomId),
      onMessage: handleServerMessage,
      webSocketFactory,
    });
    clientRef.current = client;

    sendDragRef.current = createThrottled((payload: NoteDragPayload) => {
      client.send({
        type: "note:drag",
        noteId: payload.id,
        x: payload.x,
        y: payload.y,
      });
    }, DRAG_BROADCAST_THROTTLE_MS);

    return () => {
      sendDragRef.current?.cancel();
      sendDragRef.current = null;
      clientRef.current = null;
      client.close();
    };
  }, [roomId, handleServerMessage, webSocketFactory]);

  const handleAddNote = useCallback(() => {
    // 楽観挿入はしない: note:inserted の配信を待つ（RoomDO は同 colo の
    // 単一オブジェクトなので往復は短く、ID 生成をサーバーに一本化できる）。
    clientRef.current?.send({ type: "note:create" });
  }, []);

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
    (noteId: string, x: number, y: number) => {
      sendDragRef.current?.cancel();
      setDraggingNoteId(null);
      setNotes((current) =>
        applyNoteEvent(
          current,
          { operation: "DRAG", noteId, x, y },
          { draggingNoteId: null },
        ),
      );
      // ドロップ確定だけを永続化する（ドラッグ中の座標はサーバーに残らない）。
      clientRef.current?.send({ type: "note:move", noteId, x, y });
    },
    [],
  );

  const handleNoteContentChange = useCallback(
    (noteId: string, content: string) => {
      // 入力中の見た目を止めないため本文だけは楽観更新する。
      setNotes((current) =>
        current.map((note) =>
          note.id === noteId ? { ...note, content } : note,
        ),
      );
      clientRef.current?.send({ type: "note:update-content", noteId, content });
    },
    [],
  );

  const handleNoteDelete = useCallback((noteId: string) => {
    clientRef.current?.send({ type: "note:delete", noteId });
  }, []);

  return (
    <BoardView
      notes={notes}
      inviteCode={inviteCode}
      inviteUrl={inviteUrl}
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
