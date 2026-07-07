// Phase 0 ゲート検証: RoomDO が WebSocket を受け入れ、メッセージを往復できること。
// vitest-pool-workers (workerd 実行) が Vitest 4 系で動くことの確認を兼ねる。
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

function roomStub(name: string) {
  return env.ROOM_DO.get(env.ROOM_DO.idFromName(name));
}

describe("RoomDO WebSocket ゲート検証", () => {
  it("WebSocket 以外のリクエストは 426 を返す", async () => {
    const res = await roomStub("room-a").fetch("https://do/anything");
    expect(res.status).toBe(426);
  });

  it("WebSocket upgrade を受け入れ、メッセージがエコーされる", async () => {
    const res = await roomStub("room-b").fetch("https://do/ws", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);

    const ws = res.webSocket;
    if (!ws) throw new Error("webSocket missing on 101 response");
    ws.accept();

    const received = new Promise<string>((resolve) => {
      ws.addEventListener("message", (event) => resolve(String(event.data)));
    });
    ws.send("hello");

    expect(await received).toBe("echo:hello");
    ws.close();
  });
});
