// api-worker の REST 境界スキーマ。Next の Server Actions（クライアント側）と
// api-worker（サーバー側）の両方が参照するコントラクト層。
import { z } from "zod";
import { PhaseSchema } from "./room-protocol";

export const SyncUserResponseSchema = z.object({
  userId: z.string().uuid(),
});

// ルーム作成直後のレスポンス。最小限の形を維持し、進行状態などの派生情報は
// ルーム情報取得 (/api/rooms/[id]) 側にだけ載せる（作成直後は lobby 確定で
// 十分なので追加しない）。
export const RoomSummarySchema = z.object({
  roomId: z.string().uuid(),
  inviteCode: z.string(),
});

export const CreateRoomResponseSchema = RoomSummarySchema;

export const JoinRoomResponseSchema = z.object({
  roomId: z.string().uuid(),
});

// ルーム情報取得のレスポンス。isHost / phase はこのエンドポイントでのみ返す:
// - isHost: クライアントが「開始」ボタンの表示を制御するために必要。
//   サーバーが session.sub === rooms.host_id を判定して返す。クライアントが
//   rooms.host_id を直接受け取る形だと「他人のルームの host_id が漏れる」
//   経路が増えるため、isHost フラグの形でだけ返す。
// - phase: 現在の進行状態。start_phase の二重防御用に進行状態を観測可能にする。
export const RoomInfoResponseSchema = RoomSummarySchema.extend({
  isHost: z.boolean(),
  phase: PhaseSchema,
});

// メンバー一覧のレスポンス。SSR で初期表示を組み立てるために使う。
// Realtime での member_joined は WS 側で別途配信する。
export const RoomMemberSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
});
export const RoomMembersResponseSchema = z.object({
  members: z.array(RoomMemberSchema),
});
