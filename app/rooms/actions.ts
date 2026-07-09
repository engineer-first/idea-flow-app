"use server";

// ルーム作成/参加/退出の Server Actions 境界。
// 実体は api-worker（D1 + RoomDO）へ委譲し、ここでは
// 「認証されているか」「入力形式が正しいか」だけを検証する。
// 付箋の操作は Server Actions ではなく、ルーム内 WebSocket プロトコル
// （contracts/room-protocol.ts + lib/room-client）で行う。

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  CreateRoomResponseSchema,
  JoinRoomResponseSchema,
} from "@/contracts/api";
import { isUuid } from "@/contracts/ids";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/contracts/invite-code";
import { apiFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session/current-user";

const JoinRoomInputSchema = z.object({
  code: z
    .string()
    .transform((value) => normalizeInviteCode(value))
    .refine((value) => isValidInviteCode(value), {
      message: "招待コードは英数字6桁で入力してください。",
    }),
});

export async function createRoom(): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const res = await apiFetch("/api/rooms", { method: "POST" });
  // 2xx でもボディが不正 JSON（プロキシの HTML エラーページ等）のことがある。
  // 例外で落とさず、非 2xx と同じエラーリダイレクトへ倒す。
  const parsed = res.ok
    ? CreateRoomResponseSchema.safeParse(await res.json().catch(() => null))
    : null;

  if (!parsed?.success) {
    redirect(
      `/home?error=${encodeURIComponent("ルームを作成できませんでした。")}`,
    );
  }

  // #70: 作成直後は lobby 状態なので、ボードではなくスタート画面へ遷移する。
  // ?created=1 クエリで「ルームを作成しました」通知を start ページで出す。
  redirect(`/rooms/${parsed.data.roomId}/start?created=1`);
}

export async function joinRoom(formData: FormData): Promise<void> {
  const parsedInput = JoinRoomInputSchema.safeParse({
    code: String(formData.get("code") ?? ""),
  });

  if (!parsedInput.success) {
    redirect(
      `/home?error=${encodeURIComponent("招待コードは英数字6桁で入力してください。")}`,
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const res = await apiFetch("/api/rooms/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: parsedInput.data.code }),
  });
  const parsed = res.ok
    ? JoinRoomResponseSchema.safeParse(await res.json().catch(() => null))
    : null;

  if (!parsed?.success) {
    redirect(
      `/home?error=${encodeURIComponent("ルームが見つかりませんでした。")}`,
    );
  }

  // #70: 参加したらボードではなくスタート画面へ遷移する。
  // ?joined=1 クエリで「ルームに参加しました」通知を出す。
  redirect(`/rooms/${parsed.data.roomId}/start?joined=1`);
}

// #70 退室機能。
// roomId を hidden フィールド経由で受け取る（Server Action のフォーム送信）。
// 未ログインは /login へ、ルーム未存在は / へリダイレクト。
// 実処理は api-worker の POST /api/rooms/:id/leave へ委譲する。
export async function leaveRoom(formData: FormData): Promise<void> {
  const roomId = String(formData.get("roomId") ?? "");

  if (!isUuid(roomId)) {
    redirect("/home");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 404（既に退出済み / 存在しない / 非メンバー / 解散済み）は成功相当でホームへ。
  // ホストの leave はサーバ側でルーム解散になる。
  // 5xx は呼び出し側でリカバリする。
  const res = await apiFetch(`/api/rooms/${roomId}/leave`, {
    method: "POST",
  });

  if (res.status === 404) {
    // 既に退出済み（または解散済み）— ホームに戻す
    redirect("/home");
  }
  if (!res.ok) {
    throw new Error(`ルーム退出 API が失敗しました: ${res.status}`);
  }

  redirect("/home");
}
