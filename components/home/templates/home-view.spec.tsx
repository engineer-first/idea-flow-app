// ホーム template の単体テスト。
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/rooms/actions", () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
}));

import { HomeView } from "@/components/home/templates/home-view";

function renderView(
  overrides: Partial<React.ComponentProps<typeof HomeView>> = {},
) {
  return render(<HomeView {...overrides} />);
}

describe("HomeView", () => {
  it("data-testid=home-view で描画される", () => {
    renderView();
    expect(screen.getByTestId("home-view")).toBeInTheDocument();
  });

  it("IdeaFlow タイトルは出さない（ヘッダー専用）", () => {
    renderView();
    expect(screen.queryByText("IdeaFlow")).not.toBeInTheDocument();
  });

  it("案内文言「ルームを作成するか…」は出さない（旧コピー禁止）", () => {
    renderView();
    expect(screen.queryByText(/ルームを作成するか/)).not.toBeInTheDocument();
  });

  it("セッション開始の見出しがある", () => {
    renderView();
    expect(
      screen.getByRole("heading", { name: "セッションを始めましょう" }),
    ).toBeInTheDocument();
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

  it("「ルームに参加」セクションがある", () => {
    renderView();
    const section = screen.getByTestId("home-join-room");
    expect(section).toHaveTextContent("ルームに参加");
  });
});
