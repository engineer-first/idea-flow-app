"use client";

// ルームボードのコンテナ（状態・副作用を持つ側）。
// 表示は BoardView / NoteCard / RoomMembers に委譲し、ここでは
//   - RoomDO への WebSocket 接続（lib/room-client）とサーバーメッセージの適用
//   - ドラッグ中イベントのスロットル送信
//   - 操作のプロトコルメッセージ化（contracts/room-protocol.ts）
//   - members / phase state の管理（app/rooms/room-reducer.ts）
//   - 退出のトリガ（#70 退室機能）
// を担当する。関心の分離のため、room-client や notes/room-reducer への依存は
// このファイルに閉じ込める。
//
// 確定状態の真実はサーバー（RoomDO）側にあり、再接続時は snapshot で復元される。
// 削除は楽観更新しない: author 以外の削除はサーバーが forbidden で拒否するため、
// 確定（note:deleted）を待ってから消すことで「消えたのに戻る」揺れを避ける。
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { notify } from "@/app/_lib/notify";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { leaveRoom } from "@/app/rooms/actions";
import {
  applyServerMessage,
  moveNoteLocally,
  type Note,
} from "@/app/rooms/notes-reducer";
import {
  applyMemberServerMessage,
  applyPhaseServerMessage,
  type Member,
} from "@/app/rooms/room-reducer";
import { createThrottled } from "@/app/rooms/throttle";
import { DRAG_BROADCAST_THROTTLE_MS } from "@/contracts/board";
import type { Phase, ServerMessage } from "@/contracts/room-protocol";
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
  currentUserId: string;
  // 自分がこのルームのホストかどうか（表示用。#70 では機能制御には使わない）。
  isHost: boolean;
  // ホストの userId（メンバー一覧の「ホスト」ラベル表示用）。
  hostUserId: string;
  // SSR 時にサーバーから取得した初期状態。再接続時の flicker を抑える。
  initialMembers: Member[];
  initialPhase: Phase;
  // テストからフェイク WebSocket を注入するための口。本番では未指定。
  webSocketFactory?: RoomSocketFactory;
};

type NoteDragPayload = { id: string; x: number; y: number };

export function RoomBoard({
  roomId,
  inviteCode,
  inviteUrl,
  currentUserId,
  isHost,
  hostUserId,
  initialMembers,
  initialPhase,
  webSocketFactory,
}: RoomBoardProps) {
  // 付箋の初期状態は空。確定状態の真実はサーバー（RoomDO）側にあり、
  // 接続直後に送られてくる snapshot で復元される。
  const [notes, setNotes] = useState<Note[]>([]);
  // メンバー一覧と進行状態は SSR で初期値を渡せるので、初回の白画面を防ぐ。
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  // createRoomClient が生成直後に "connecting" を通知するので初期値と一致する。
  const [connectionStatus, setConnectionStatus] =
    useState<RoomConnectionStatus>("connecting");
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isLeavePending, startLeaveTransition] = useTransition();
  const draggingNoteIdRef = useRef<string | null>(null);
  const membersRef = useRef<Member[]>(members);
  const clientRef = useRef<RoomClient | null>(null);
  const sendDragRef = useRef<ReturnType<
    typeof createThrottled<[NoteDragPayload]>
  > | null>(null);

  useEffect(() => {
    draggingNoteIdRef.current = draggingNoteId;
  }, [draggingNoteId]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    if (message.type === "error") {
      console.error(`ルーム操作エラー (${message.code}): ${message.message}`);
      return;
    }
    setNotes((current) =>
      applyServerMessage(current, message, {
        draggingNoteId: draggingNoteIdRef.current,
      }),
    );
    // member_joined / member_left は自分以外の参加者から届く通知。
    // 自分自身の参加・退出はサーバから届かない（broadcastToAllExcept）。
    if (message.type === "member_joined") {
      notify.memberJoined(message.member.name);
    }
    if (message.type === "member_left") {
      // member_left は userId のみなので、除去前の members から名前を引く。
      const left = membersRef.current.find((m) => m.userId === message.userId);
      if (left) {
        notify.memberLeft(left.name);
      }
    }
    // ref を同期更新して、連続メッセージでも最新 members を引けるようにする。
    const nextMembers = applyMemberServerMessage(membersRef.current, message);
    membersRef.current = nextMembers;
    setMembers(nextMembers);
    setPhase((current) => applyPhaseServerMessage(current, message));
  }, []);

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
      // 自分自身の操作なので即座にローカル反映する。
      setNotes((current) => moveNoteLocally(current, noteId, x, y));
      sendDragRef.current?.({ id: noteId, x, y });
    },
    [],
  );

  const handleNoteDragEnd = useCallback(
    (noteId: string, x: number, y: number) => {
      sendDragRef.current?.cancel();
      setDraggingNoteId(null);
      setNotes((current) => moveNoteLocally(current, noteId, x, y));
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

  // 退出（#70 退室機能）。BoardView 内の LeaveConfirmDialog から呼ばれる。
  // 1. 自分の WS を能動的に閉じる（再接続を抑制し、UX として「もう受信しない」を即時反映）
  // 2. Server Action leaveRoom(formData) を呼ぶ。内部で api-worker を fetch し
  //    redirect("/") でホームへ戻る。
  // redirect は NEXT_REDIRECT エラーを throw するので、useTransition の枠内で
  // 呼んで throw を握りつぶす（Next.js がクライアントの遷移を処理する）。
  // 確認 Dialog 自体は BoardView 側の state として持つ。
  const handleLeave = useCallback(() => {
    if (isLeaving || isLeavePending) return;
    setIsLeaving(true);
    // 自分の WS を能動的に閉じる。RoomDO.leave でも閉じられるが、
    // 早く「閉じた」体験にすることで再接続を試みない。
    clientRef.current?.close();
    startLeaveTransition(async () => {
      const formData = new FormData();
      formData.append("roomId", roomId);
      try {
        await leaveRoom(formData);
      } catch (error) {
        // redirect は NEXT_REDIRECT を throw する仕様（Next.js の内部）なので
        // それを握りつぶす。next/navigation が router に遷移を通知する。
        if (
          error &&
          typeof error === "object" &&
          "digest" in error &&
          typeof (error as { digest?: unknown }).digest === "string" &&
          (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          return;
        }
        throw error;
      }
    });
  }, [isLeaving, isLeavePending, roomId]);

  return (
    <BoardView
      notes={notes}
      inviteCode={inviteCode}
      inviteUrl={inviteUrl}
      connectionStatus={connectionStatus}
      draggingNoteId={draggingNoteId}
      members={members}
      currentUserId={currentUserId}
      isHost={isHost}
      hostUserId={hostUserId}
      phase={phase}
      onAddNote={handleAddNote}
      onNoteDragStart={handleNoteDragStart}
      onNoteDragMove={handleNoteDragMove}
      onNoteDragEnd={handleNoteDragEnd}
      onNoteContentChange={handleNoteContentChange}
      onNoteDelete={handleNoteDelete}
      onLeave={handleLeave}
      isLeaving={isLeaving}
    />
  );
}
