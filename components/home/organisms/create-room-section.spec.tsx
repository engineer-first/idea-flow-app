import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PUSH = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: PUSH }),
}));

const CREATE_ROOM = vi.fn();
vi.mock("@/app/rooms/actions", () => ({
  createRoom: (...args: unknown[]) => CREATE_ROOM(...args),
}));

const notifyMocks = vi.hoisted(() => ({
  roomCreated: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/app/_lib/notify", () => ({
  notify: {
    roomCreated: notifyMocks.roomCreated,
    error: notifyMocks.error,
  },
}));

import { CreateRoomSection } from "@/components/home/organisms/create-room-section";

describe("CreateRoomSection", () => {
  beforeEach(() => {
    PUSH.mockReset();
    CREATE_ROOM.mockReset();
    notifyMocks.roomCreated.mockReset();
    notifyMocks.error.mockReset();
  });

  it("「ルームを作成」ボタンを描画する", () => {
    render(<CreateRoomSection />);
    expect(
      screen.getByRole("button", { name: "ルームを作成" }),
    ).toBeInTheDocument();
  });

  it("作成成功時は toast して start へ遷移する", async () => {
    const user = userEvent.setup();
    CREATE_ROOM.mockResolvedValueOnce({
      ok: true,
      roomId: "123e4567-e89b-42d3-a456-426614174000",
    });
    render(<CreateRoomSection />);
    await user.click(screen.getByRole("button", { name: "ルームを作成" }));
    await waitFor(() => {
      expect(notifyMocks.roomCreated).toHaveBeenCalledTimes(1);
      expect(PUSH).toHaveBeenCalledWith(
        "/rooms/123e4567-e89b-42d3-a456-426614174000/start",
      );
    });
  });

  it("作成失敗時は error toast を出し遷移しない", async () => {
    const user = userEvent.setup();
    CREATE_ROOM.mockResolvedValueOnce({
      ok: false,
      error: "ルームを作成できませんでした。",
    });
    render(<CreateRoomSection />);
    await user.click(screen.getByRole("button", { name: "ルームを作成" }));
    await waitFor(() => {
      expect(notifyMocks.error).toHaveBeenCalledWith(
        "ルームを作成できませんでした。",
      );
    });
    expect(PUSH).not.toHaveBeenCalled();
    expect(notifyMocks.roomCreated).not.toHaveBeenCalled();
  });
});
