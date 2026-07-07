// workers テスト共通のヘルパー。
import { env, runInDurableObject } from "cloudflare:test";
import type { RoomDO } from "./room-do";

// RoomDO のインスタンスメソッドを直接呼び出して内部状態を検査する。
export function runInRoomDO<T>(
  roomId: string,
  fn: (instance: RoomDO) => T | Promise<T>,
): Promise<T> {
  const stub = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));
  return runInDurableObject(stub, fn);
}
