"use client";

// ルームボードのコンテナ。関心ごとの hook を束ねて view に渡すだけにする。
//   - WebSocket 接続と切断時の遷移: use-room-connection
//   - 付箋の状態・楽観更新ポリシー・プロトコル化: use-room-notes
//   - グループの状態とプロトコル化: use-note-groups
//   - members / phase / timer の適用と入退出通知: use-room-state
//   - 退出 / 解散フロー: use-leave-room
// このファイルに残るのは「フェーズ進行の operation 化」と「エラー応答の
// 画面反応（強制進行ダイアログ）」というボード画面固有の配線だけ。
//
// 確定状態の真実はサーバー（RoomDO）側にあり、再接続時は snapshot で復元される。
import { useCallback, useState } from "react";
import type { Phase, ServerMessage } from "@/contracts/room-protocol";
import { useNoteGroups, useRoomNotes } from "@/features/notes";
import { notify } from "@/lib/notify";
import type { RoomSocketFactory } from "@/lib/room-client/room-client";
import type { Member } from "../logic/room-reducer";
import { useLeaveRoom } from "../logic/use-leave-room";
import { useRoomConnection } from "../logic/use-room-connection";
import { useRoomState } from "../logic/use-room-state";
import { ForceNextPhaseDialog } from "./force-next-phase-dialog";
import { RoomBoardView } from "./room-board-view";

export type RoomBoardProps = {
  roomId: string;
  inviteCode: string;
  inviteUrl: string;
  currentUserId: string;
  // 自分がこのルームのホストかどうか（表示用・操作制御）。
  isHost: boolean;
  // ホストの userId（メンバー一覧の「ホスト」ラベル表示用）。
  hostUserId: string;
  // SSR 時にサーバーから取得した初期状態。再接続時の flicker を抑える。
  initialMembers: Member[];
  initialPhase: Phase;
  // テストからフェイク WebSocket を注入するための口。本番では未指定。
  webSocketFactory?: RoomSocketFactory;
};

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
  const [isNextPhasePending, setIsNextPhasePending] = useState(false);
  const [isForceNextPhaseDialogOpen, setIsForceNextPhaseDialogOpen] =
    useState(false);

  const { isLeaving, isLeavingRef, leave } = useLeaveRoom({ roomId, isHost });
  // onMessage にはホイスティングされる関数宣言（下記）を渡す。
  // useRoomConnection は常に最新のハンドラへ配送するため、
  // ハンドラの再生成で再接続されることはない。
  const { connectionStatus, send } = useRoomConnection({
    roomId,
    onMessage: handleServerMessage,
    webSocketFactory,
    isLeavingRef,
  });
  const notes = useRoomNotes({ send });
  const noteGroups = useNoteGroups({ send });
  const roomState = useRoomState({ initialMembers, initialPhase });

  function handleServerMessage(message: ServerMessage) {
    const receivedAt = Date.now();
    if (message.type === "error") {
      // 投票未完了によるゲート拒否はホストの phase:next 起点なので、toast
      // ではなく「強制的に進むか」の確認ダイアログで案内する。サーバーの
      // 評価順が変わって非ホストに届いた場合は通常のエラー表示へ落とす。
      if (message.code === "voting-incomplete" && isHost) {
        setIsNextPhasePending(false);
        setIsForceNextPhaseDialogOpen(true);
        return;
      }
      console.warn(`ルーム操作エラー (${message.code}): ${message.message}`);
      notify.error(message.message);
      if (message.code === "forbidden") {
        setIsNextPhasePending(false);
      }
      return;
    }

    if (message.type === "phase:updated" || message.type === "snapshot") {
      setIsNextPhasePending(false);
      // 進行が確定（別タブ等）・復元（再接続）されたら、開いていた
      // 強制進行の確認は phase3 のゲート前提が崩れているため閉じる。
      setIsForceNextPhaseDialogOpen(false);
    }

    notes.applyMessage(message);
    noteGroups.applyMessage(message);
    roomState.applyMessage(message, receivedAt);
  }

  const handleNextPhase = useCallback(() => {
    if (isNextPhasePending) return;
    setIsNextPhasePending(true);
    send({ type: "phase:next" });
  }, [isNextPhasePending, send]);

  // 投票未完了ゲートの脱出ハッチ。ForceNextPhaseDialog の確認後に
  // force 付きで再送する（ホスト以外はサーバー側で拒否される）。
  const handleForceNextPhase = useCallback(() => {
    setIsForceNextPhaseDialogOpen(false);
    if (isNextPhasePending) return;
    setIsNextPhasePending(true);
    send({ type: "phase:next", force: true });
  }, [isNextPhasePending, send]);

  const handleTimerStart = useCallback(
    (durationMs: number) => send({ type: "timer:start", durationMs }),
    [send],
  );
  const handleTimerPause = useCallback(
    () => send({ type: "timer:pause" }),
    [send],
  );
  const handleTimerResume = useCallback(
    () => send({ type: "timer:resume" }),
    [send],
  );
  const handleTimerExtend = useCallback(
    () => send({ type: "timer:extend" }),
    [send],
  );
  const handleTimerStop = useCallback(
    () => send({ type: "timer:stop" }),
    [send],
  );

  return (
    <>
      <ForceNextPhaseDialog
        open={isForceNextPhaseDialogOpen}
        onOpenChange={setIsForceNextPhaseDialogOpen}
        onConfirm={handleForceNextPhase}
      />
      <RoomBoardView
        notes={notes.notes.filter((note) => note.visibility === "shared")}
        privateNotes={notes.notes.filter(
          (note) => note.visibility === "private",
        )}
        groups={noteGroups.groups}
        inviteCode={inviteCode}
        inviteUrl={inviteUrl}
        phase={roomState.phase}
        timer={roomState.timer}
        timerServerOffsetMs={roomState.timerServerOffsetMs}
        isHost={isHost}
        connectionStatus={connectionStatus}
        draggingNoteId={notes.draggingNoteId}
        members={roomState.members}
        currentUserId={currentUserId}
        hostUserId={hostUserId}
        isNextPhasePending={isNextPhasePending}
        onAddPrivateNote={notes.addNote}
        onPrivateNoteContentChange={notes.changeNoteContent}
        onPrivateNoteDelete={notes.deleteNote}
        onPrivateNotePublish={notes.publishNote}
        onPrivateNoteUnpublish={notes.unpublishNote}
        onNextPhase={handleNextPhase}
        onTimerStart={handleTimerStart}
        onTimerPause={handleTimerPause}
        onTimerResume={handleTimerResume}
        onTimerExtend={handleTimerExtend}
        onTimerStop={handleTimerStop}
        onNoteDragStart={notes.startNoteDrag}
        onNoteDragMove={notes.moveNote}
        onNoteDragEnd={notes.endNoteDrag}
        onNoteContentChange={notes.changeNoteContent}
        onNoteDelete={notes.deleteNote}
        onGroupCreate={noteGroups.createGroup}
        onGroupUpdateName={noteGroups.renameGroup}
        onNoteVote={notes.voteNote}
        onNoteVoteReset={notes.resetNoteVote}
        onLeave={leave}
        isLeaving={isLeaving}
      />
    </>
  );
}
