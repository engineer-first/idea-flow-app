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
import {
  applyServerMessage,
  moveNoteLocally,
  type Note,
  resetNoteVoteLocally,
  voteNoteLocally,
} from "@/app/rooms/notes-reducer";
import { createThrottled } from "@/app/rooms/throttle";
import { DRAG_BROADCAST_THROTTLE_MS } from "@/contracts/board";
import type { DotVoteKind, Phase, ServerMessage } from "@/contracts/room-protocol";
import {
  createRoomClient,
  type RoomClient,
  type RoomConnectionStatus,
  type RoomSocketFactory,
} from "@/lib/room-client/room-client";
import { roomWebSocketUrl } from "@/lib/room-client/ws-url";

export type RoomBoardProps = {
  roomId: string;
  inviteCode: string;
  inviteUrl: string;
  // テストからフェイク WebSocket を注入するための口。本番では未指定。
  webSocketFactory?: RoomSocketFactory;
};

type NoteDragPayload = { id: string; x: number; y: number };

export function RoomBoard({
  roomId,
  inviteCode,
  inviteUrl,
  webSocketFactory,
}: RoomBoardProps) {
  // 付箋の初期状態は空。確定状態の真実はサーバー（RoomDO）側にあり、
  // 接続直後に送られてくる snapshot で復元される。
  const [notes, setNotes] = useState<Note[]>([]);
  const [phase, setPhase] = useState<Phase>("phase1");
  const [isHost, setIsHost] = useState(false);
  // createRoomClient が生成直後に "connecting" を通知するので初期値と一致する。
  const [connectionStatus, setConnectionStatus] =
    useState<RoomConnectionStatus>("connecting");
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const notesRef = useRef<Note[]>([]);
  const draggingNoteIdRef = useRef<string | null>(null);
  const clientRef = useRef<RoomClient | null>(null);
  const sendDragRef = useRef<ReturnType<
    typeof createThrottled<[NoteDragPayload]>
  > | null>(null);
  const [isNextPhasePending, setIsNextPhasePending] = useState(false);

  useEffect(() => {
    draggingNoteIdRef.current = draggingNoteId;
  }, [draggingNoteId]);

  const updateNotes = useCallback((update: (current: Note[]) => Note[]) => {
    const next = update(notesRef.current);
    notesRef.current = next;
    setNotes(next);
    return next;
  }, []);

  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      if (message.type === "error") {
        console.warn(`ルーム操作エラー (${message.code}): ${message.message}`);
        return;
      }

    if (message.type === "snapshot") {
      setPhase(message.phase);
      setIsHost(message.isHost);
    }

    if (message.type === "phase:updated") {
      setPhase(message.phase);
      setIsNextPhasePending(false);
      return;
    }

      updateNotes((current) =>
        applyServerMessage(current, message, {
          draggingNoteId: draggingNoteIdRef.current,
        }),
      );
    },
    [updateNotes],
  );

  useEffect(() => {
    const client = createRoomClient({
      url: roomWebSocketUrl(roomId),
      onMessage: handleServerMessage,
      onStatusChange: setConnectionStatus,
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
      notesRef.current = [];
      client.close();
    };
  }, [roomId, handleServerMessage, webSocketFactory]);

  const handleAddNote = useCallback(() => {
    // 楽観挿入はしない: note:inserted の配信を待つ（RoomDO は同 colo の
    // 単一オブジェクトなので往復は短く、ID 生成をサーバーに一本化できる）。
    clientRef.current?.send({ type: "note:create" });
  }, []);

  const handleNextPhase = useCallback(() => {
    if (isNextPhasePending) return;

    setIsNextPhasePending(true);

    clientRef.current?.send({
      type: "phase:next",
    });
  }, [isNextPhasePending]);

  const handleNoteDragStart = useCallback((noteId: string) => {
    setDraggingNoteId(noteId);
  }, []);

  const handleNoteDragMove = useCallback(
    (noteId: string, x: number, y: number) => {
      // 自分自身の操作なので即座にローカル反映する。
      updateNotes((current) => moveNoteLocally(current, noteId, x, y));
      sendDragRef.current?.({ id: noteId, x, y });
    },
    [updateNotes],
  );

  const handleNoteDragEnd = useCallback(
    (noteId: string, x: number, y: number) => {
      sendDragRef.current?.cancel();
      setDraggingNoteId(null);
      updateNotes((current) => moveNoteLocally(current, noteId, x, y));
      // ドロップ確定だけを永続化する（ドラッグ中の座標はサーバーに残らない）。
      clientRef.current?.send({ type: "note:move", noteId, x, y });
    },
    [updateNotes],
  );

  const handleNoteContentChange = useCallback(
    (noteId: string, content: string) => {
      // 入力中の見た目を止めないため本文だけは楽観更新する。
      updateNotes((current) =>
        current.map((note) =>
          note.id === noteId ? { ...note, content } : note,
        ),
      );
      clientRef.current?.send({ type: "note:update-content", noteId, content });
    },
    [updateNotes],
  );

  const handleNoteDelete = useCallback((noteId: string) => {
    clientRef.current?.send({ type: "note:delete", noteId });
  }, []);

  const handleNoteVote = useCallback(
    (noteId: string, kind: DotVoteKind) => {
      const result = voteNoteLocally(notesRef.current, noteId, kind);
      if (!result.accepted) {
        return;
      }
      updateNotes(() => result.notes);
      clientRef.current?.send({ type: "note:vote", noteId, kind });
    },
    [updateNotes],
  );

  const handleNoteVoteReset = useCallback(
    (noteId: string, kind: DotVoteKind) => {
      const result = resetNoteVoteLocally(notesRef.current, noteId, kind);
      if (!result.accepted) {
        return;
      }
      updateNotes(() => result.notes);
      clientRef.current?.send({ type: "note:vote-reset", noteId, kind });
    },
    [updateNotes],
  );

  return (
    <BoardView
      notes={notes}
      inviteCode={inviteCode}
      inviteUrl={inviteUrl}
      phase={phase}
      isHost={isHost}
      connectionStatus={connectionStatus}
      draggingNoteId={draggingNoteId}
      isNextPhasePending={isNextPhasePending}
      onAddNote={handleAddNote}
      onNextPhase={handleNextPhase}
      onNoteDragStart={handleNoteDragStart}
      onNoteDragMove={handleNoteDragMove}
      onNoteDragEnd={handleNoteDragEnd}
      onNoteContentChange={handleNoteContentChange}
      onNoteDelete={handleNoteDelete}
      onNoteVote={handleNoteVote}
      onNoteVoteReset={handleNoteVoteReset}
    />
  );
}
