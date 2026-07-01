import { describe, expect, it } from "vitest";

describe("msw", () => {
  it("intercepts /api/health in vitest", async () => {
    const res = await fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
