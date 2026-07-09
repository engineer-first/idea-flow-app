// ホーム画面（ルーム作成・参加）のプレゼンテーション層の単体テスト。
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeView } from "@/app/home-view";

function renderView(
  overrides: Partial<React.ComponentProps<typeof HomeView>> = {},
) {
  return render(
    <HomeView
      userEmail="user@example.com"
      createRoomAction={vi.fn()}
      signOutAction={vi.fn()}
      {...overrides}
    />,
  );
}

describe("HomeView", () => {
  it("data-testid=home-view で描画される", () => {
    renderView();
    expect(screen.getByTestId("home-view")).toBeInTheDocument();
  });

  it("タイトル IdeaFlow と userEmail を表示する", () => {
    renderView({ userEmail: "alice@example.com" });
    expect(screen.getByText("IdeaFlow")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("「ルームを作成」ボタンがある", () => {
    renderView();
    expect(
      screen.getByRole("button", { name: "ルームを作成" }),
    ).toBeInTheDocument();
  });

  it("招待コード入力フォームがある", () => {
    renderView();
    expect(screen.getByLabelText("招待コード")).toBeInTheDocument();
    expect(screen.getByTestId("join-room-form")).toBeInTheDocument();
  });

  it("error があるとき role=alert で表示する", () => {
    renderView({ error: "ルームが見つかりませんでした。" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ルームが見つかりませんでした。",
    );
  });

  it("error が無いとき alert は出ない", () => {
    renderView();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ヘッダーに「ログアウト」ボタンがある", () => {
    renderView();
    const header = screen.getByTestId("home-view-header");
    expect(header).toContainElement(
      screen.getByRole("button", { name: "ログアウト" }),
    );
  });

  it("「ルームに参加」セクションがある", () => {
    renderView();
    const section = screen.getByTestId("home-join-room");
    expect(section).toHaveTextContent("ルームに参加");
  });
});
