// ルーム内 WebSocket プロトコルのコントラクト。
// クライアント（lib/room-client）と RoomDO の両方がこのスキーマを import し、
// 境界を流れるメッセージはすべてここで検証される。
//
// 設計上の不変条件:
// - authorId を書き換えるメッセージは存在しない（構造的に不可能にする）。
//   Supabase 時代に列レベル GRANT で塞いだ権限昇格攻撃を、プロトコルの形で塞ぐ。
//   authorId はサーバーが接続時のヘッダー（検証済みユーザーID）から決める。
// - roomId はそもそもプロトコルに現れない。1 RoomDO = 1 ルームなので、
//   接続先（どの DO に繋いでいるか）自体が roomId を意味しており、
//   メッセージの中に含めて信頼する必要がない。
// - note:drag は永続化されない一時データ。確定は note:move だけが行う。
// - member_joined / phase_changed は閲覧者全員に届く共有情報。名前や
//   ロールをクライアントが書き換えるプロトコルは存在しない（host 判定は
//   api-worker が SessionPayload と D1 rooms.host_id で行い、RoomDO は
//   その結果だけを受け取って setPhase する）。
import { z } from "zod";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./board";

export const NOTE_CONTENT_MAX_LENGTH = 2000;

export const NoteSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string(),
  x: z.number(),
  y: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProtocolNote = z.infer<typeof NoteSchema>;

// ルームの進行状態。サーバーが真実をもち、phase_changed で全員に同期する。
// クライアントから書き換える経路は存在しない（host でも start_phase を送るだけ）。
export const PhaseSchema = z.enum(["lobby", "writing"]);
export type Phase = z.infer<typeof PhaseSchema>;

// メンバー一覧スナップショットの単位。userId と表示名だけを持ち、
// 画像 URL や権限フラグはここに載せない（#70 のスコープで画像は出さない）。
export const MemberSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
});
export type ProtocolMember = z.infer<typeof MemberSchema>;

const NotePositionSchema = {
  x: z.number().finite().min(0).max(BOARD_WIDTH),
  y: z.number().finite().min(0).max(BOARD_HEIGHT),
};

// ---------------------------------------------------------------
// クライアント → サーバー
// ---------------------------------------------------------------

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("note:create") }),
  z.object({
    type: z.literal("note:update-content"),
    noteId: z.string().uuid(),
    content: z
      .string()
      .max(NOTE_CONTENT_MAX_LENGTH, "本文は2000文字以内で入力してください。"),
  }),
  // ドロップ確定（永続化する）
  z.object({
    type: z.literal("note:move"),
    noteId: z.string().uuid(),
    ...NotePositionSchema,
  }),
  // ドラッグ中の一時共有（永続化しない）
  z.object({
    type: z.literal("note:drag"),
    noteId: z.string().uuid(),
    ...NotePositionSchema,
  }),
  z.object({
    type: z.literal("note:delete"),
    noteId: z.string().uuid(),
  }),
  // ホストがルームの進行状態を次に進める（サーバーが host 判定して通す/落とす）。
  z.object({ type: z.literal("start_phase") }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------
// サーバー → クライアント
// ---------------------------------------------------------------

// RoomDO が WS を閉じるときに使う close code / reason。
// クライアントはこれを見て再接続を打ち切り、必要ならホームへ誘導する。
// 4000: 個人の退出 / 4001: ホストによるルーム解散
export const WS_CLOSE_LEFT_ROOM = 4000;
export const WS_CLOSE_LEFT_ROOM_REASON = "left the room";
export const WS_CLOSE_ROOM_DISBANDED = 4001;
export const WS_CLOSE_ROOM_DISBANDED_REASON = "room disbanded";

export const ServerMessageSchema = z.discriminatedUnion("type", [
  // 接続直後・再接続時に現在状態を一括送信する（復帰パスの本体）。
  // members は「現在のメンバー一覧（参加順）」をスナップショットに含める形。
  // phase も必ず載せ、切断中に start_phase が進んでも再接続で復帰できるようにする。
  z.object({
    type: z.literal("snapshot"),
    notes: z.array(NoteSchema),
    members: z.array(MemberSchema),
    phase: PhaseSchema,
  }),
  z.object({ type: z.literal("note:inserted"), note: NoteSchema }),
  z.object({ type: z.literal("note:updated"), note: NoteSchema }),
  z.object({ type: z.literal("note:deleted"), noteId: z.string().uuid() }),
  z.object({
    type: z.literal("note:drag"),
    noteId: z.string().uuid(),
    x: z.number(),
    y: z.number(),
  }),
  // 新しいメンバーが参加したことを全員に通知する（Realtime 反映）。
  z.object({
    type: z.literal("member_joined"),
    member: MemberSchema,
  }),
  // メンバーが退出したことを全員に通知する（Realtime 反映）。退室者は
  // broadcast から除外される（自身の close は api-worker 側の RoomDO.leave
  // で行うため、本人宛の member_left は届かない）。
  z.object({
    type: z.literal("member_left"),
    userId: z.string().uuid(),
  }),
  // ホストが進行状態を進めたことを全員に通知する。
  z.object({
    type: z.literal("phase_changed"),
    phase: PhaseSchema,
  }),
  z.object({
    type: z.literal("error"),
    code: z.enum(["invalid-message", "forbidden", "not-found"]),
    message: z.string(),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = ClientMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = ServerMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
