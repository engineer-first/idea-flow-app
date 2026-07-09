// LeaveConfirmDialog の単体テスト。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeaveConfirmDialog } from "@/app/rooms/leave-confirm-dialog";

describe("LeaveConfirmDialog（leave）", () => {
  it("open=true のとき「退出しますか？」が表示される", () => {
    render(
      <LeaveConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isLeaving={false}
      />,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("退出しますか？")).toBeInTheDocument();
    expect(
      screen.getByText(/退出すると、このルームに戻るには/),
    ).toBeInTheDocument();
  });

  it("「退出する」ボタンで onConfirm が呼ばれる", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <LeaveConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        isLeaving={false}
      />,
    );
    await user.click(screen.getByTestId("leave-confirm-action"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("isLeaving=true のとき全ボタンが disabled になる", () => {
    render(
      <LeaveConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isLeaving
      />,
    );
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(screen.getByTestId("leave-confirm-action")).toBeDisabled();
    expect(screen.getByTestId("leave-confirm-action")).toHaveTextContent(
      "退出中…",
    );
  });
});

describe("LeaveConfirmDialog（disband）", () => {
  it("ホスト向けに解散文言を表示する", () => {
    render(
      <LeaveConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isLeaving={false}
        mode="disband"
      />,
    );
    expect(screen.getByText("ルームを解散しますか？")).toBeInTheDocument();
    expect(screen.getByText(/解散するとルームは削除され/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ルームを解散" }),
    ).toBeInTheDocument();
  });

  it("isLeaving=true のとき「解散中…」になる", () => {
    render(
      <LeaveConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isLeaving
        mode="disband"
      />,
    );
    expect(screen.getByTestId("leave-confirm-action")).toHaveTextContent(
      "解散中…",
    );
  });
});
