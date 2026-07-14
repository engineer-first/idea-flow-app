// 共通ヘッダーのプレゼンテーション層テスト。
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth", () => ({
  signOut: vi.fn(),
}));

import { AppHeader } from "@/app/app-header";

describe("AppHeader", () => {
  it("data-testid=app-header で描画される", () => {
    render(<AppHeader userName="田中太郎" />);
    expect(screen.getByTestId("app-header")).toBeInTheDocument();
  });

  it("左に IdeaFlow を表示する", () => {
    render(<AppHeader userName="田中太郎" />);
    expect(screen.getByTestId("app-header-brand")).toHaveTextContent(
      "IdeaFlow",
    );
  });

  it("ユーザー名をログアウトの左に表示する", () => {
    render(<AppHeader userName="田中太郎" />);
    expect(screen.getByTestId("app-header-user-name")).toHaveTextContent(
      "田中太郎",
    );
    expect(
      screen.getByRole("button", { name: "ログアウト" }),
    ).toBeInTheDocument();
  });

  it("メールアドレスは表示しない", () => {
    render(<AppHeader userName="田中太郎" />);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("userName が空ならユーザー名は描画しない", () => {
    render(<AppHeader userName="" />);
    expect(
      screen.queryByTestId("app-header-user-name"),
    ).not.toBeInTheDocument();
  });
});
