// ルーム作成/参加直後のワンショット通知用フラッシュ Cookie。
// URL クエリに頼らず、「実際に作成/参加した直後」だけ toast を出せる。
//
// このファイルは Server Actions 専用（先頭 "use server"）。
// - setRoomFlash: createRoom / joinRoom から
// - consumeRoomFlash: クライアント（RoomStartBoard）から
// Cookie の set/delete は Server Action でのみ可能なため、Server Component では読まない。
"use server";

import { cookies } from "next/headers";

const ROOM_FLASH_COOKIE = "idea_flow_room_flash";

export type RoomFlash = "room-created" | "room-joined";

export async function setRoomFlash(flash: RoomFlash): Promise<void> {
  const store = await cookies();
  store.set(ROOM_FLASH_COOKIE, flash, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60,
  });
}

// 読んで即座に消す（ワンショット）。
export async function consumeRoomFlash(): Promise<RoomFlash | null> {
  const store = await cookies();
  const value = store.get(ROOM_FLASH_COOKIE)?.value;
  if (value === "room-created" || value === "room-joined") {
    store.delete(ROOM_FLASH_COOKIE);
    return value;
  }
  if (value) {
    store.delete(ROOM_FLASH_COOKIE);
  }
  return null;
}
