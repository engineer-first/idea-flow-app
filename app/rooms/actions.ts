"use server";

// ルーム作成/参加の Server Actions 境界。
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
  const parsed = res.ok
    ? CreateRoomResponseSchema.safeParse(await res.json())
    : null;

  if (!parsed?.success) {
    redirect(`/?error=${encodeURIComponent("ルームを作成できませんでした。")}`);
  }

  redirect(`/rooms/${parsed.data.roomId}`);
}

export async function joinRoom(formData: FormData): Promise<void> {
  const parsedInput = JoinRoomInputSchema.safeParse({
    code: String(formData.get("code") ?? ""),
  });

  if (!parsedInput.success) {
    redirect(
      `/?error=${encodeURIComponent("招待コードは英数字6桁で入力してください。")}`,
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
    ? JoinRoomResponseSchema.safeParse(await res.json())
    : null;

  if (!parsed?.success) {
    redirect(`/?error=${encodeURIComponent("ルームが見つかりませんでした。")}`);
  }

  redirect(`/rooms/${parsed.data.roomId}`);
}
