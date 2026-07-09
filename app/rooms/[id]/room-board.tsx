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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { notify } from "@/app/_lib/notify";
import { BoardView } from "@/app/rooms/[id]/board-view";
import { leaveRoom } from "@/app/rooms/actions";
import {
  applyServerMessage,
  moveNoteLocally,
  type Note,
  resetNoteVoteLocally,
  voteNoteLocally,
} from "@/app/rooms/notes-reducer";
import {
  applyMemberServerMessage,
  applyPhaseServerMessage,
  type Member,
} from "@/app/rooms/room-reducer";
import { createThrottled } from "@/app/rooms/throttle";
import { DRAG_BROADCAST_THROTTLE_MS } from "@/contracts/board";
import type {
  DotVoteKind,
  Phase,
  ServerMessage,
} from "@/contracts/room-protocol";
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
  const router = useRouter();
  // 付箋の初期状態は空。確定状態の真実はサーバー（RoomDO）側にあり、
  // 接続直後に送られてくる snapshot で復元される。
  const [notes, setNotes] = useState<Note[]>([]);
  // メンバー一覧と進行状態は SSR で初期値を渡せるので、初回の白画面を防ぐ。
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  // createRoomClient が生成直後に "connecting" を通知するので初期値と一致する。
  // ended / disbanded は set せずホームへ redirect する。
  const [connectionStatus, setConnectionStatus] =
    useState<Exclude<RoomConnectionStatus, "ended" | "disbanded">>(
      "connecting",
    );
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isLeavePending, startLeaveTransition] = useTransition();
  const draggingNoteIdRef = useRef<string | null>(null);
  const membersRef = useRef<Member[]>(members);
  const notesRef = useRef<Note[]>(notes);
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

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    if (message.type === "error") {
      console.warn(`ルーム操作エラー (${message.code}): ${message.message}`);
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

  const isLeavingRef = useRef(false);
  useEffect(() => {
    isLeavingRef.current = isLeaving;
  }, [isLeaving]);

  const handleStatusChange = useCallback(
    (status: RoomConnectionStatus) => {
      // 退出・解散による意図的切断: 再接続せずホームへ戻す。
      if (status === "ended" || status === "disbanded") {
        // 他メンバーが解散されたときだけここで理由を出す。
        // 自分の操作による通知は handleLeave 成功時に出す（二重 toast 防止）。
        if (status === "disbanded" && !isLeavingRef.current) {
          notify.roomDisbanded();
        }
        router.replace("/home");
        return;
      }
      setConnectionStatus(status);
    },
    [router],
  );

  useEffect(() => {
    const client = createRoomClient({
      url: roomWebSocketUrl(roomId),
      onMessage: handleServerMessage,
      onStatusChange: handleStatusChange,
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
  }, [roomId, handleServerMessage, handleStatusChange, webSocketFactory]);

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

  const handleNoteVote = useCallback((noteId: string, kind: DotVoteKind) => {
    const result = voteNoteLocally(notesRef.current, noteId, kind);
    if (!result.accepted) return;
    notesRef.current = result.notes;
    setNotes(result.notes);
    clientRef.current?.send({ type: "note:vote", noteId, kind });
  }, []);

  const handleNoteVoteReset = useCallback(
    (noteId: string, kind: DotVoteKind) => {
      const result = resetNoteVoteLocally(notesRef.current, noteId, kind);
      if (!result.accepted) return;
      notesRef.current = result.notes;
      setNotes(result.notes);
      clientRef.current?.send({ type: "note:vote-reset", noteId, kind });
    },
    [],
  );

  // 退出 / 解散（#70）。BoardView 内の LeaveConfirmDialog から呼ばれる。
  // API 成功後に redirect でホームへ戻る。失敗時は WS を維持し isLeaving を戻す。
  // （先に close すると失敗時に再接続不能になるため、close は RoomDO に任せる）
  // redirect は NEXT_REDIRECT を throw するので useTransition 内で握りつぶす。
  const handleLeave = useCallback(() => {
    if (isLeaving || isLeavePending) return;
    // WS close(4001) が leave 完了前に届いても roomDisbanded を出さないよう、
    // setState のコミットを待たず ref を同期で立てる。
    isLeavingRef.current = true;
    setIsLeaving(true);
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
          // 自分の操作成功をトーストで伝える（ホーム遷移後も Toaster は root にある）。
          if (isHost) {
            notify.roomDisbandedBySelf();
          } else {
            notify.roomLeft();
          }
          return;
        }
        // 5xx 等: WS は開いたまま、操作可能に戻す。
        isLeavingRef.current = false;
        setIsLeaving(false);
        const message =
          error instanceof Error
            ? error.message
            : "ルームからの退出に失敗しました。";
        notify.error(message);
      }
    });
  }, [isLeaving, isLeavePending, roomId, isHost]);

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
      onNoteVote={handleNoteVote}
      onNoteVoteReset={handleNoteVoteReset}
      onLeave={handleLeave}
      isLeaving={isLeaving}
    />
  );
}
