// api-worker の REST 境界スキーマ。Next の Server Actions（クライアント側）と
// api-worker（サーバー側）の両方が参照するコントラクト層。
import { z } from "zod";

export const SyncUserResponseSchema = z.object({
  userId: z.string().uuid(),
});

export const CreateRoomResponseSchema = z.object({
  roomId: z.string().uuid(),
  inviteCode: z.string(),
});

export const JoinRoomResponseSchema = z.object({
  roomId: z.string().uuid(),
});

export const RoomInfoResponseSchema = z.object({
  roomId: z.string().uuid(),
  inviteCode: z.string(),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
});
