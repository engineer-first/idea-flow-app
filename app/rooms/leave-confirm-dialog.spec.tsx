// LeaveConfirmDialog の単体テスト。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeaveConfirmDialog } from "@/app/rooms/leave-confirm-dialog";

describe("LeaveConfirmDialog", () => {
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

  it("open=false のとき Dialog が表示されない", () => {
    render(
      <LeaveConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isLeaving={false}
      />,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("「キャンセル」ボタンで onOpenChange(false) が呼ばれる", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <LeaveConfirmDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
        isLeaving={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
