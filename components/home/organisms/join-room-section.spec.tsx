import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/rooms/actions", () => ({
  joinRoom: vi.fn(),
  lookupInviteRoom: vi.fn(),
}));

import { JoinRoomSection } from "@/components/home/organisms/join-room-section";

describe("JoinRoomSection", () => {
  it("招待コード入力と「ルームに参加」見出しを描画する", () => {
    render(<JoinRoomSection />);
    expect(screen.getByTestId("home-join-room")).toHaveTextContent(
      "ルームに参加",
    );
    expect(screen.getByLabelText("招待コード")).toBeInTheDocument();
    expect(screen.getByTestId("join-room-form")).toBeInTheDocument();
  });
});
