// ルーム内 WebSocket プロトコルのコントラクト。
// クライアント（lib/room-client）と RoomDO の両方がこのスキーマを import し、
// 境界を流れるメッセージはすべてここで検証される。
//
// 設計上の不変条件:
// - authorId / roomId を書き換えるメッセージは存在しない（構造的に不可能にする）。
//   Supabase 時代に列レベル GRANT で塞いだ権限昇格攻撃を、プロトコルの形で塞ぐ。
// - note:drag は永続化されない一時データ。確定は note:move だけが行う。
import { z } from "zod";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./board";

export const NOTE_CONTENT_MAX_LENGTH = 2000;

export const NoteSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string(),
  x: z.number(),
  y: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProtocolNote = z.infer<typeof NoteSchema>;

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
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------
// サーバー → クライアント
// ---------------------------------------------------------------

export const ServerMessageSchema = z.discriminatedUnion("type", [
  // 接続直後・再接続時に現在状態を一括送信する（復帰パスの本体）
  z.object({
    type: z.literal("snapshot"),
    room: z.object({
      roomId: z.string().uuid(),
      inviteCode: z.string(),
    }),
    self: z.object({ userId: z.string().uuid() }),
    notes: z.array(NoteSchema),
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
