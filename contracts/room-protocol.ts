// ルーム内 WebSocket プロトコルのコントラクト。
// クライアント（lib/room-client）と RoomDO の両方がこのスキーマを import し、
// 境界を流れるメッセージはすべてここで検証される。
//
// 設計上の不変条件:
// - authorId を書き換えるメッセージは存在しない（構造的に不可能にする）。
// - roomId はプロトコルに現れない（1 RoomDO = 1 ルーム）。
// - note:drag は永続化されない一時データ。確定は note:move だけが行う。
//
// フェーズモデル:
// - lobby: 開始前ロビー（メンバー確認・招待）。start_phase で phase1 へ。
// - phase1-3: 課題の記入・整理・投票工程。phase4 は投票結果の確認画面。
import { z } from "zod";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./board";

export const NOTE_CONTENT_MAX_LENGTH = 2000;

export const DOT_VOTE_LIMITS = {
  subjective: 1,
  objective: 3,
} as const;

export const DotVoteKindSchema = z.enum(["subjective", "objective"]);
export type DotVoteKind = z.infer<typeof DotVoteKindSchema>;

const DotVoteSummarySchema = z.object({
  count: z.number().int().min(0),
  votedByMe: z.boolean(),
  ownCount: z.number().int().min(0),
});

export const NoteSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string(),
  x: z.number(),
  y: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dotVotes: z.object({
    subjective: DotVoteSummarySchema,
    objective: DotVoteSummarySchema,
  }),
});

export type ProtocolNote = z.infer<typeof NoteSchema>;

export const GroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(50, "グループ名は50文字以内で入力してください。"),
  noteIds: z.array(z.string().uuid()).min(2),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProtocolGroup = z.infer<typeof GroupSchema>;

// lobby = 開始前 / phase1-3 = ボード上の工程 / phase4 = 投票結果
export const PhaseSchema = z.enum([
  "lobby",
  "phase1",
  "phase2",
  "phase3",
  "phase4",
]);
export type Phase = z.infer<typeof PhaseSchema>;

// メンバー一覧スナップショットの単位。
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
  z.object({
    type: z.literal("note:move"),
    noteId: z.string().uuid(),
    ...NotePositionSchema,
  }),
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
  z.object({
    type: z.literal("note:vote"),
    noteId: z.string().uuid(),
    kind: DotVoteKindSchema,
  }),
  z.object({
    type: z.literal("note:vote-reset"),
    noteId: z.string().uuid(),
    kind: DotVoteKindSchema,
  }),
  // ロビーからボードへ（lobby → phase1）。ホストのみ。
  z.object({ type: z.literal("start_phase") }),
  // ボード内の次工程（phase1 → phase2 → phase3 → phase4）。ホストのみ。
  z.object({ type: z.literal("phase:next") }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------
// サーバー → クライアント
// ---------------------------------------------------------------

export const WS_CLOSE_LEFT_ROOM = 4000;
export const WS_CLOSE_LEFT_ROOM_REASON = "left the room";
export const WS_CLOSE_ROOM_DISBANDED = 4001;
export const WS_CLOSE_ROOM_DISBANDED_REASON = "room disbanded";

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot"),
    notes: z.array(NoteSchema),
    groups: z.array(GroupSchema).optional(),
    members: z.array(MemberSchema),
    phase: PhaseSchema,
    isHost: z.boolean(),
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
    type: z.literal("member_joined"),
    member: MemberSchema,
  }),
  z.object({
    type: z.literal("member_left"),
    userId: z.string().uuid(),
  }),
  // start_phase 成功時（ロビー離脱）にも phase:next 成功時にも使う。
  z.object({
    type: z.literal("phase:updated"),
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
