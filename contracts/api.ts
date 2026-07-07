// api-worker の REST 境界スキーマ。Next の Server Actions（クライアント側）と
// api-worker（サーバー側）の両方が参照するコントラクト層。
import { z } from "zod";

export const SyncUserResponseSchema = z.object({
  userId: z.string().uuid(),
});

// ルーム作成直後のレスポンスと、ルーム情報取得のレスポンスは同じ形（roomId +
// inviteCode）。実体を1つにまとめ、両エンドポイントはそこから導出することで
// 「同じ形であること」自体をコードで表現する。将来レスポンスが分岐した場合に
// 備え、export 名はエンドポイントごとに維持する。
export const RoomSummarySchema = z.object({
  roomId: z.string().uuid(),
  inviteCode: z.string(),
});

export const CreateRoomResponseSchema = RoomSummarySchema;

export const JoinRoomResponseSchema = z.object({
  roomId: z.string().uuid(),
});

export const RoomInfoResponseSchema = RoomSummarySchema;
