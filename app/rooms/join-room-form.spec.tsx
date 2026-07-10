// JoinRoomForm の単体テスト。
// 招待コードを入力 → lookup でホスト名解決 → 確認 Dialog → joinRoom → toast / 遷移。
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PUSH = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: PUSH }),
}));

const JOIN_ROOM = vi.fn();
const LOOKUP_INVITE = vi.fn();
vi.mock("@/app/rooms/actions", () => ({
  joinRoom: (...args: unknown[]) => JOIN_ROOM(...args),
  lookupInviteRoom: (...args: unknown[]) => LOOKUP_INVITE(...args),
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

import { JoinRoomForm } from "@/app/rooms/join-room-form";

async function openConfirmDialog(user: ReturnType<typeof userEvent.setup>) {
  LOOKUP_INVITE.mockResolvedValueOnce({
    ok: true,
    hostName: "田中太郎",
    inviteCode: "AB12CD",
  });
  render(<JoinRoomForm />);
  await user.type(screen.getByLabelText("招待コード"), "AB12CD");
  await user.click(screen.getByRole("button", { name: "参加する" }));
  await waitFor(() => {
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
}

describe("JoinRoomForm", () => {
  beforeEach(() => {
    PUSH.mockReset();
    JOIN_ROOM.mockReset();
    LOOKUP_INVITE.mockReset();
    notifyMocks.joinedAsGuest.mockReset();
    notifyMocks.error.mockReset();
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
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "参加する" }),
      ).not.toBeDisabled();
    });
  });

  it("「参加する」クリックで lookup 後にホスト名付き Dialog が開く", async () => {
    const user = userEvent.setup();
    await openConfirmDialog(user);
    expect(
      screen.getByText("田中太郎 さんが作成したルームに参加しますか？"),
    ).toBeInTheDocument();
    expect(screen.getByText("AB12CD")).toBeInTheDocument();
    expect(LOOKUP_INVITE).toHaveBeenCalledWith("AB12CD");
  });

  it("lookup 失敗時は error toast を出し Dialog を開かない", async () => {
    const user = userEvent.setup();
    LOOKUP_INVITE.mockResolvedValueOnce({
      ok: false,
      error: "ルームが見つかりませんでした。",
    });
    render(<JoinRoomForm />);
    await user.type(screen.getByLabelText("招待コード"), "AB12CD");
    await user.click(screen.getByRole("button", { name: "参加する" }));
    await waitFor(() => {
      expect(notifyMocks.error).toHaveBeenCalledWith(
        "ルームが見つかりませんでした。",
      );
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("Dialog の「参加する」確定で toast して start へ遷移する", async () => {
    const user = userEvent.setup();
    await openConfirmDialog(user);
    JOIN_ROOM.mockResolvedValueOnce({
      ok: true,
      roomId: "123e4567-e89b-42d3-a456-426614174000",
    });
    await user.click(screen.getByTestId("join-confirm-action"));
    await waitFor(() => {
      expect(notifyMocks.joinedAsGuest).toHaveBeenCalledTimes(1);
      expect(PUSH).toHaveBeenCalledWith(
        "/rooms/123e4567-e89b-42d3-a456-426614174000/start",
      );
    });
    const formData = JOIN_ROOM.mock.calls[0]?.[0] as FormData | undefined;
    expect(formData?.get("code")).toBe("AB12CD");
  });

  it("参加失敗時は error toast を出し遷移しない", async () => {
    const user = userEvent.setup();
    await openConfirmDialog(user);
    JOIN_ROOM.mockResolvedValueOnce({
      ok: false,
      error: "ルームが見つかりませんでした。",
    });
    await user.click(screen.getByTestId("join-confirm-action"));
    await waitFor(() => {
      expect(notifyMocks.error).toHaveBeenCalledWith(
        "ルームが見つかりませんでした。",
      );
    });
    expect(PUSH).not.toHaveBeenCalled();
    expect(notifyMocks.joinedAsGuest).not.toHaveBeenCalled();
  });

  it("Dialog の「キャンセル」で Dialog が閉じる", async () => {
    const user = userEvent.setup();
    await openConfirmDialog(user);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(JOIN_ROOM).not.toHaveBeenCalled();
  });
});
