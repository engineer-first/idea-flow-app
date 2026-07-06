import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/app/auth/actions", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/app/rooms/actions", () => ({
  createRoom: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "11111111-1111-1111-1111-111111111111",
    email: "owner@example.test",
  })),
}));

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: vi.fn(() => true),
}));

describe("Home", () => {
  it("ログイン済みユーザーにルーム作成操作を表示する", async () => {
    render(await Home());

    expect(screen.getByRole("button", { name: "ルームを作成" })).toBeTruthy();
    expect(screen.getByText("owner@example.test")).toBeTruthy();
  });
});
