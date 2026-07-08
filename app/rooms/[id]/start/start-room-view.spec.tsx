// スタート画面のプレゼンテーション層の単体テスト。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";
import { StartRoomView } from "@/app/rooms/[id]/start/start-room-view";

const ME = "11111111-1111-4111-8111-111111111111";

function renderView(
  overrides: Partial<React.ComponentProps<typeof StartRoomView>> = {},
) {
  return render(
    <StartRoomView
      members={buildMembers(3, ME)}
      currentUserId={ME}
      isHost
      phase="lobby"
      inviteCode="AB12CD"
      inviteUrl="https://idea-flow.example/invite/AB12CD"
      connectionStatus="open"
      isStarting={false}
      onStart={vi.fn()}
      onLeave={vi.fn()}
      isLeaving={false}
      {...overrides}
    />,
  );
}

describe("StartRoomView", () => {
  it("ホストのとき「開始する」ボタンが表示される", () => {
    renderView();
    expect(screen.getByTestId("start-phase-button")).toHaveTextContent(
      "開始する",
    );
  });

  it("非ホストのときはボタンが非表示で「お待ちください」文言が出る", () => {
    renderView({ isHost: false });
    expect(screen.queryByTestId("start-phase-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("start-room-view-waiting")).toBeInTheDocument();
  });

  it("「開始する」クリックで onStart が呼ばれる", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    renderView({ onStart });
    await user.click(screen.getByTestId("start-phase-button"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("isStarting=true のときボタンが disabled になり文言が「開始中…」になる", () => {
    renderView({ isStarting: true });
    const button = screen.getByTestId("start-phase-button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("開始中…");
  });

  it("接続が切れているときはボタンが disabled になる", () => {
    renderView({ connectionStatus: "closed" });
    expect(screen.getByTestId("start-phase-button")).toBeDisabled();
  });

  it("接続が切れているときは再接続中の表示が出る", () => {
    renderView({ connectionStatus: "closed" });
    expect(screen.getByRole("status")).toHaveTextContent("再接続");
  });

  it("phase=lobby のときバッジは「開始前」", () => {
    renderView({ phase: "lobby" });
    const view = screen.getByTestId("start-room-view");
    expect(within(view).getByText("開始前")).toBeInTheDocument();
  });

  it("メンバー数を見出しに出す", () => {
    renderView({ members: buildMembers(4, ME) });
    expect(
      screen.getByTestId("start-room-view-member-count"),
    ).toHaveTextContent("4 名");
  });

  it("data-phase と data-host を container がテストから参照できる形で持つ", () => {
    renderView({ phase: "lobby", isHost: true });
    const view = screen.getByTestId("start-room-view");
    expect(view).toHaveAttribute("data-phase", "lobby");
    expect(view).toHaveAttribute("data-host", "true");
  });
});

describe("退出ボタン（#70 退室機能）", () => {
  it("「退出する」ボタンが描画される（ホスト／非ホスト共通）", () => {
    renderView();
    expect(
      screen.getByRole("button", { name: "退出する" }),
    ).toBeInTheDocument();
  });

  it("「退出する」クリックで確認 Dialog が開き、確定で onLeave が呼ばれる", async () => {
    const onLeave = vi.fn();
    const user = userEvent.setup();
    renderView({ onLeave });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "退出する" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("leave-confirm-action"));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("「キャンセル」で Dialog が閉じて onLeave は呼ばれない", async () => {
    const onLeave = vi.fn();
    const user = userEvent.setup();
    renderView({ onLeave });
    await user.click(screen.getByRole("button", { name: "退出する" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("isLeaving=true のときボタンは disabled で文言が「退出中…」", () => {
    renderView({ isLeaving: true });
    const button = screen.getByRole("button", { name: /退出/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("退出中…");
  });
});

describe("招待URL/コード（host 限定表示）", () => {
  it("host のとき招待URLと招待コードが表示される", () => {
    renderView({
      isHost: true,
      inviteCode: "ZZ99XX",
      inviteUrl: "https://example/invite/ZZ99XX",
    });
    expect(
      screen.getByText("https://example/invite/ZZ99XX"),
    ).toBeInTheDocument();
    expect(screen.getByText("ZZ99XX")).toBeInTheDocument();
  });

  it("非 host のとき招待URLと招待コードが表示されない", () => {
    renderView({
      isHost: false,
      inviteCode: "ZZ99XX",
      inviteUrl: "https://example/invite/ZZ99XX",
    });
    expect(
      screen.queryByText("https://example/invite/ZZ99XX"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("ZZ99XX")).not.toBeInTheDocument();
  });
});
