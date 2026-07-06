import { describe, expect, it, vi } from "vitest";
import { signInWithPassword } from "@/app/auth/actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  isDevAuthEnabled: vi.fn(() => true),
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: vi.fn(async () => ({
        error: { message: "Invalid login credentials" },
      })),
    },
  })),
}));

describe("signInWithPassword", () => {
  it("ログイン失敗時も招待URLのnextを維持する", async () => {
    const formData = new FormData();
    formData.set("email", "owner@example.test");
    formData.set("password", "wrong-password");
    formData.set("next", "/invite/abc123");

    await expect(signInWithPassword(formData)).rejects.toThrow(
      "redirect:/login?error=Invalid+login+credentials&next=%2Finvite%2Fabc123",
    );
  });
});
