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

// snapshot / member_joined を受けて members state を更新する純粋関数。
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
    case "note:inserted":
    case "note:updated":
    case "note:deleted":
    case "note:drag":
    case "phase_changed":
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
    case "phase_changed": {
      return message.phase;
    }
    case "snapshot": {
      // snapshot には現時点で phase を含めない（プロトコルの最小形）。
      // 将来 snapshot.phase を含める拡張をしたら、ここで採用する。
      return phase;
    }
    case "note:inserted":
    case "note:updated":
    case "note:deleted":
    case "note:drag":
    case "member_joined":
    case "error":
      return phase;
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}
