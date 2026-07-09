import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => {
  const map = new Map<string, string>();
  return {
    get: vi.fn((name: string) => {
      const value = map.get(name);
      return value === undefined ? undefined : { name, value };
    }),
    set: vi.fn((name: string, value: string) => {
      map.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      map.delete(name);
    }),
    _map: map,
    _reset: () => map.clear(),
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

import { consumeRoomFlash, setRoomFlash } from "@/app/rooms/flash";

// flash.ts 内の Cookie 名と一致させる（"use server" ファイルは定数を export できない）。
const ROOM_FLASH_COOKIE = "idea_flow_room_flash";

describe("room flash cookie", () => {
  beforeEach(() => {
    cookieStore._reset();
    cookieStore.get.mockClear();
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
  });

  it("setRoomFlash で Cookie を書き込む", async () => {
    await setRoomFlash("room-created");
    expect(cookieStore.set).toHaveBeenCalledWith(
      ROOM_FLASH_COOKIE,
      "room-created",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
  });

  it("consumeRoomFlash は値を返して Cookie を消す", async () => {
    cookieStore._map.set(ROOM_FLASH_COOKIE, "room-joined");
    await expect(consumeRoomFlash()).resolves.toBe("room-joined");
    expect(cookieStore.delete).toHaveBeenCalledWith(ROOM_FLASH_COOKIE);
  });

  it("consumeRoomFlash は不正値を消して null を返す", async () => {
    cookieStore._map.set(ROOM_FLASH_COOKIE, "unknown");
    await expect(consumeRoomFlash()).resolves.toBeNull();
    expect(cookieStore.delete).toHaveBeenCalledWith(ROOM_FLASH_COOKIE);
  });

  it("Cookie が無いとき null", async () => {
    await expect(consumeRoomFlash()).resolves.toBeNull();
  });
});
