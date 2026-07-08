// JoinRoomForm の単体テスト。
// 招待コードを入力 → 確認 Dialog が開く → 確定で joinRoom Server Action 実行。
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const JOIN_ROOM = vi.fn();
vi.mock("@/app/rooms/actions", () => ({
  joinRoom: (...args: unknown[]) => JOIN_ROOM(...args),
}));

import { JoinRoomForm } from "@/app/rooms/join-room-form";

describe("JoinRoomForm", () => {
  beforeEach(() => {
    JOIN_ROOM.mockReset();
  });

  it("招待コード入力フォームが描画される", () => {
    render(<JoinRoomForm />);
    expect(screen.getByLabelText("招待コード")).toBeInTheDocument();
  });

  it("6 桁英数字以外は「参加する」ボタンが disabled", () => {
    render(<JoinRoomForm />);
    const button = screen.getByRole("button", { name: "参加する" });
    expect(button).toBeDisabled();
  });

  it("6 桁英数字を入れると「参加する」ボタンが enabled", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText("招待コード") as HTMLInputElement;
    await user.type(input, "AB12CD");
    expect(input.value).toBe("AB12CD");
    // state 更新 → re-render を待つ
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "参加する" }),
      ).not.toBeDisabled();
    });
  });

  it("「参加する」クリックで確認 Dialog が開く", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText("招待コード"), "AB12CD");
    await user.click(screen.getByRole("button", { name: "参加する" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("AB12CD")).toBeInTheDocument();
  });

  it("Dialog の「参加する」確定で joinRoom Server Action が呼ばれる", async () => {
    const user = userEvent.setup();
    JOIN_ROOM.mockResolvedValueOnce(undefined);
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText("招待コード"), "AB12CD");
    await user.click(screen.getByRole("button", { name: "参加する" }));
    await user.click(screen.getByTestId("join-confirm-action"));
    expect(JOIN_ROOM).toHaveBeenCalledTimes(1);
    const formData = JOIN_ROOM.mock.calls[0]?.[0] as FormData | undefined;
    expect(formData?.get("code")).toBe("AB12CD");
  });

  it("Dialog の「キャンセル」で Dialog が閉じる", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText("招待コード"), "AB12CD");
    await user.click(screen.getByRole("button", { name: "参加する" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(JOIN_ROOM).not.toHaveBeenCalled();
  });
});
