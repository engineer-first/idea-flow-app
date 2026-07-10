// ルームの「ノート以外」の状態（メンバー一覧・進行状態）に対する純粋関数群。
// ノート (notes) は app/rooms/notes-reducer.ts が担当し、責務を分離する。
//
// 設計:
// - members は参加順を維持する（snapshot.members / member_joined の双方が
//   同じ順序規約に従う前提）。同一 userId の重複は作らない。
// - phase はサーバーが真実を持つ。lobby がデフォルト。
import type {
  Phase,
  ProtocolMember,
  ServerMessage,
} from "@/contracts/room-protocol";

export type Member = ProtocolMember;

// snapshot / member_joined / member_left を受けて members state を更新する純粋関数。
// 進行状態メッセージは早期 return。
export function applyMemberServerMessage(
  members: Member[],
  message: ServerMessage,
): Member[] {
  switch (message.type) {
    case "snapshot": {
      return message.members.map((m) => ({ userId: m.userId, name: m.name }));
    }
    case "member_joined": {
      const exists = members.some((m) => m.userId === message.member.userId);
      if (exists) {
        // 同一ユーザーの再参加は name を最新化して反映。
        return members.map((m) =>
          m.userId === message.member.userId ? message.member : m,
        );
      }
      return [...members, message.member];
    }
    case "member_left": {
      // 退出者を members から取り除く。
      // サーバ側で broadcastToAllExcept により本人には届かないため、
      // ここで受け取る userId は常に「他人の退出」を意味する。
      return members.filter((m) => m.userId !== message.userId);
    }
    case "note:inserted":
    case "note:updated":
    case "note:deleted":
    case "note:drag":
    case "phase:updated":
    case "error":
      return members;
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}

// phase state を更新する純粋関数。phase 以外のメッセージは何もしない。
export function applyPhaseServerMessage(
  phase: Phase,
  message: ServerMessage,
): Phase {
  switch (message.type) {
    case "phase:updated": {
      // start_phase / phase:next の両方で配信される。
      return message.phase;
    }
    case "snapshot": {
      // 再接続時の復帰パス。切断中に進んだ phase もここで取り込む。
      return message.phase;
    }
    case "note:inserted":
    case "note:updated":
    case "note:deleted":
    case "note:drag":
    case "member_joined":
    case "member_left":
    case "error":
      return phase;
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}
