"use client";

// スタート画面（メンバー一覧 + 開始ボタン）のコンテナ（状態・副作用を持つ側）。
// 表示は StartRoomView に委譲し、ここでは
//   - RoomDO への WebSocket 接続（lib/room-client）とサーバーメッセージの適用
//   - ホスト判定付きの start_phase 送信
//   - phase_changed 受信後の /rooms/[id] への自動遷移
//   - members / phase state の管理（app/rooms/room-reducer.ts）
//   - 退出のトリガ（#70 退室機能）
//   - 自分自身の遷移に応じた通知（toast）
//   - 他メンバーの参加通知（toast）
// を担当する。ノートは扱わない（#70 のスコープ）。
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { notify } from "@/app/_lib/notify";
import { StartRoomView } from "@/app/rooms/[id]/start/start-room-view";
import { leaveRoom } from "@/app/rooms/actions";
import {
  applyMemberServerMessage,
  applyPhaseServerMessage,
  type Member,
} from "@/app/rooms/room-reducer";
import type {
  ClientMessage,
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

export type RoomStartBoardProps = {
  roomId: string;
  inviteCode: string;
  inviteUrl: string;
  currentUserId: string;
  isHost: boolean;
  // ホストの userId（メンバー一覧の「ホスト」ラベル表示用）。
  hostUserId: string;
  initialPhase: Phase;
  initialMembers: Member[];
  // テストからフェイク WebSocket を注入するための口。本番では未指定。
  webSocketFactory?: RoomSocketFactory;
};

export function RoomStartBoard({
  roomId,
  inviteCode,
  inviteUrl,
  currentUserId,
  isHost,
  hostUserId,
  initialPhase,
  initialMembers,
  webSocketFactory,
}: RoomStartBoardProps) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  // ended / disbanded は set せずホームへ redirect する。
  const [connectionStatus, setConnectionStatus] =
    useState<Exclude<RoomConnectionStatus, "ended" | "disbanded">>(
      "connecting",
    );
  const [isStarting, setIsStarting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isLeavePending, startLeaveTransition] = useTransition();
  const clientRef = useRef<RoomClient | null>(null);
  const membersRef = useRef<Member[]>(members);
  const isLeavingRef = useRef(false);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStartTimeout = useCallback(() => {
    if (startTimeoutRef.current !== null) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    isLeavingRef.current = isLeaving;
  }, [isLeaving]);

  useEffect(() => {
    return () => {
      clearStartTimeout();
    };
  }, [clearStartTimeout]);

  // 既に writing ならボードへ直行（SSR でも redirect しているが、state 初期値が
  // 古い場合のリカバリとしても機能する）。
  useEffect(() => {
    if (phase === "writing") {
      router.replace(`/rooms/${roomId}`);
    }
  }, [phase, roomId, router]);

  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      if (message.type === "error") {
        console.error(`ルーム操作エラー (${message.code}): ${message.message}`);
        if (message.code === "forbidden") {
          // 権限なしで start_phase を送った場合は「開始中」を解除してあげる
          // （押せたのに実は押せなかった、を伝える）。
          clearStartTimeout();
          setIsStarting(false);
        }
        return;
      }
      // member_joined / member_left は自分以外の参加者から届く通知。
      // 自分自身の参加・退出はサーバから届かない（broadcastToAllExcept）。
      if (message.type === "member_joined") {
        notify.memberJoined(message.member.name);
      }
      if (message.type === "member_left") {
        // member_left は userId のみなので、除去前の members から名前を引く。
        const left = membersRef.current.find(
          (m) => m.userId === message.userId,
        );
        if (left) {
          notify.memberLeft(left.name);
        }
      }
      // ref を同期更新して、連続メッセージでも最新 members を引けるようにする。
      const nextMembers = applyMemberServerMessage(membersRef.current, message);
      membersRef.current = nextMembers;
      setMembers(nextMembers);
      setPhase((current) => applyPhaseServerMessage(current, message));
    },
    [clearStartTimeout],
  );

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
    return () => {
      clientRef.current = null;
      client.close();
    };
  }, [roomId, handleServerMessage, handleStatusChange, webSocketFactory]);

  const sendMessage = useCallback((message: ClientMessage) => {
    clientRef.current?.send(message);
  }, []);

  const handleStart = useCallback(() => {
    if (!isHost) return;
    setIsStarting(true);
    sendMessage({ type: "start_phase" });
    // 成功時は phase_changed → router.replace で /rooms/[id] へ遷移。
    // 失敗時（forbidden / 接続断）は上記の error ハンドラで isStarting を解除。
    // 万一何も起きない場合は 5 秒でタイムアウトさせて再操作可能にする。
    clearStartTimeout();
    startTimeoutRef.current = setTimeout(() => {
      startTimeoutRef.current = null;
      setIsStarting(false);
    }, 5000);
  }, [isHost, sendMessage, clearStartTimeout]);

  // 退出 / 解散（#70）。StartRoomView 内の LeaveConfirmDialog から呼ばれる。
  // API 成功後に redirect。失敗時は WS を維持し isLeaving を戻す。
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
        if (
          error &&
          typeof error === "object" &&
          "digest" in error &&
          typeof (error as { digest?: unknown }).digest === "string" &&
          (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          // 自分の操作成功をトーストで伝える。
          if (isHost) {
            notify.roomDisbandedBySelf();
          } else {
            notify.roomLeft();
          }
          return;
        }
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
    <StartRoomView
      members={members}
      currentUserId={currentUserId}
      isHost={isHost}
      hostUserId={hostUserId}
      phase={phase}
      inviteCode={inviteCode}
      inviteUrl={inviteUrl}
      connectionStatus={connectionStatus}
      isStarting={isStarting}
      onStart={handleStart}
      onLeave={handleLeave}
      isLeaving={isLeaving}
    />
  );
}
