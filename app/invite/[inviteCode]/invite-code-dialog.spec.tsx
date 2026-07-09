// InviteCodeDialog の単体テスト。
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PUSH = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: PUSH }),
}));

const JOIN_ROOM = vi.fn();
vi.mock("@/app/rooms/actions", () => ({
  joinRoom: (...args: unknown[]) => JOIN_ROOM(...args),
}));

const notifyMocks = vi.hoisted(() => ({
  joinedAsGuest: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/app/_lib/notify", () => ({
  notify: {
    joinedAsGuest: notifyMocks.joinedAsGuest,
    error: notifyMocks.error,
  },
}));

import { InviteCodeDialog } from "@/app/invite/[inviteCode]/invite-code-dialog";

function renderDialog() {
  return render(
    <InviteCodeDialog inviteCode="ABC234" hostName="田中太郎" />,
  );
}

describe("InviteCodeDialog", () => {
  beforeEach(() => {
    PUSH.mockReset();
    JOIN_ROOM.mockReset();
    notifyMocks.joinedAsGuest.mockReset();
    notifyMocks.error.mockReset();
  });

  it("招待コードとホスト名付きタイトルで Dialog が開く", () => {
    renderDialog();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("ABC234")).toBeInTheDocument();
    expect(
      screen.getByText("田中太郎 さんが作成したルームに参加しますか？"),
    ).toBeInTheDocument();
  });

  it("「参加する」確定で toast して start へ遷移する", async () => {
    const user = userEvent.setup();
    JOIN_ROOM.mockResolvedValueOnce({
      ok: true,
      roomId: "123e4567-e89b-42d3-a456-426614174000",
    });
    renderDialog();
    await user.click(screen.getByTestId("invite-join-action"));
    await waitFor(() => {
      expect(notifyMocks.joinedAsGuest).toHaveBeenCalledTimes(1);
      expect(PUSH).toHaveBeenCalledWith(
        "/rooms/123e4567-e89b-42d3-a456-426614174000/start",
      );
    });
    const formData = JOIN_ROOM.mock.calls[0]?.[0] as FormData | undefined;
    expect(formData?.get("code")).toBe("ABC234");
  });

  it("参加失敗時は error toast を出し遷移しない", async () => {
    const user = userEvent.setup();
    JOIN_ROOM.mockResolvedValueOnce({
      ok: false,
      error: "ルームが見つかりませんでした。",
    });
    renderDialog();
    await user.click(screen.getByTestId("invite-join-action"));
    await waitFor(() => {
      expect(notifyMocks.error).toHaveBeenCalledWith(
        "ルームが見つかりませんでした。",
      );
    });
    expect(PUSH).not.toHaveBeenCalled();
  });

  it("「キャンセル」クリックで /home へ戻る", async () => {
    const user = userEvent.setup();
    const original = window.location.href;
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
    renderDialog();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(window.location.href).toBe("/home");
    Object.defineProperty(window, "location", { value: original });
  });
});
