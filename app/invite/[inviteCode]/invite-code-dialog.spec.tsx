// InviteCodeDialog の単体テスト。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const JOIN_ROOM = vi.fn();
vi.mock("@/app/rooms/actions", () => ({
  joinRoom: (...args: unknown[]) => JOIN_ROOM(...args),
}));

import { InviteCodeDialog } from "@/app/invite/[inviteCode]/invite-code-dialog";

describe("InviteCodeDialog", () => {
  beforeEach(() => {
    JOIN_ROOM.mockReset();
  });

  it("招待コードを渡すと Dialog が開いた状態で表示される", () => {
    render(<InviteCodeDialog inviteCode="ABC234" />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("ABC234")).toBeInTheDocument();
  });

  it("「参加する」確定で joinRoom Server Action が招待コード付きで呼ばれる", async () => {
    const user = userEvent.setup();
    JOIN_ROOM.mockResolvedValueOnce(undefined);
    render(<InviteCodeDialog inviteCode="ABC234" />);
    await user.click(screen.getByTestId("invite-join-action"));
    expect(JOIN_ROOM).toHaveBeenCalledTimes(1);
    const formData = JOIN_ROOM.mock.calls[0]?.[0] as FormData | undefined;
    expect(formData?.get("code")).toBe("ABC234");
  });

  it("「キャンセル」クリックで Dialog が閉じる", async () => {
    const user = userEvent.setup();
    const original = window.location.href;
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
    render(<InviteCodeDialog inviteCode="ABC234" />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(window.location.href).toBe("/");
    Object.defineProperty(window, "location", { value: original });
  });
});
