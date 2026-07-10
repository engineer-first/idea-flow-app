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

export const GroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  noteIds: z.array(z.string().uuid()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProtocolGroup = z.infer<typeof GroupSchema>;

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
  z.object({
    type: z.literal("group:create"),
    group: GroupSchema,
  }),
  z.object({
    type: z.literal("group:update-name"),
    groupId: z.string().uuid(),
    name: z.string().max(50, "グループ名は50文字以内で入力してください。"),
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
    notes: z.array(NoteSchema),
    groups: z.array(GroupSchema).optional(),
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
    type: z.literal("group:updated"),
    group: GroupSchema,
  }),
  z.object({
    type: z.literal("group:deleted"),
    groupId: z.string().uuid(),
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
