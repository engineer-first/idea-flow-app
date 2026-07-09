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
import { apiFetch, lookupRoomByInviteCode } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session/current-user";

const JoinRoomInputSchema = z.object({
  code: z
    .string()
    .transform((value) => normalizeInviteCode(value))
    .refine((value) => isValidInviteCode(value), {
      message: "招待コードは英数字6桁で入力してください。",
    }),
});

// 作成/参加成功時はクライアントで toast → start へ遷移する。
// （Server Action の redirect 後に toast する方式は、遷移でクライアント状態が
// 消えるため使わない）
export type CreateRoomResult =
  | { ok: true; roomId: string }
  | { ok: false; error: string };

export type JoinRoomResult =
  | { ok: true; roomId: string }
  | { ok: false; error: string };

// 参加確認 Dialog 用。ホスト名を先に解決し、存在しないコードは Dialog を開かない。
export type LookupInviteResult =
  | { ok: true; hostName: string; inviteCode: string }
  | { ok: false; error: string };

export async function lookupInviteRoom(
  code: string,
): Promise<LookupInviteResult> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const parsedInput = JoinRoomInputSchema.safeParse({ code });
  if (!parsedInput.success) {
    return {
      ok: false,
      error: "招待コードは英数字6桁で入力してください。",
    };
  }

  const lookup = await lookupRoomByInviteCode(parsedInput.data.code);
  if (lookup.kind === "not_found") {
    return { ok: false, error: "ルームが見つかりませんでした。" };
  }
  if (lookup.kind === "unavailable") {
    return {
      ok: false,
      error:
        "ルーム情報を取得できませんでした。しばらくしてから再度お試しください。",
    };
  }

  return {
    ok: true,
    hostName: lookup.room.hostName,
    inviteCode: lookup.room.inviteCode,
  };
}

export async function createRoom(): Promise<CreateRoomResult> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const res = await apiFetch("/api/rooms", { method: "POST" });
  // 2xx でもボディが不正 JSON（プロキシの HTML エラーページ等）のことがある。
  const parsed = res.ok
    ? CreateRoomResponseSchema.safeParse(await res.json().catch(() => null))
    : null;

  if (!parsed?.success) {
    return { ok: false, error: "ルームを作成できませんでした。" };
  }

  // #70: 作成直後は lobby 状態なので、ボードではなくスタート画面へ遷移する。
  // 遷移と「ルームを作成しました」toast は呼び出し側クライアントが行う。
  return { ok: true, roomId: parsed.data.roomId };
}

export async function joinRoom(formData: FormData): Promise<JoinRoomResult> {
  const parsedInput = JoinRoomInputSchema.safeParse({
    code: String(formData.get("code") ?? ""),
  });

  if (!parsedInput.success) {
    return {
      ok: false,
      error: "招待コードは英数字6桁で入力してください。",
    };
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
    return { ok: false, error: "ルームが見つかりませんでした。" };
  }

  // #70: 参加したらボードではなくスタート画面へ遷移する。
  // 遷移と「ルームに参加しました」toast は呼び出し側クライアントが行う。
  return { ok: true, roomId: parsed.data.roomId };
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
