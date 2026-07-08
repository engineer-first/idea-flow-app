import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/app/mocks/node";

describe("msw", () => {
  it("intercepts requests registered via server.use in vitest", async () => {
    server.use(
      http.get("*/api/smoke-test-only", () =>
        HttpResponse.json({ status: "ok" }),
      ),
    );

    const res = await fetch("http://localhost/api/smoke-test-only");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
