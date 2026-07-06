import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomDetail } from "@/app/rooms/[inviteCode]/room-detail";

describe("RoomDetail", () => {
  it("招待URLと有効期限を表示する", () => {
    render(
      <RoomDetail
        inviteUrl="http://localhost:3000/invite/abc123"
        inviteExpiresAt="2026-07-07T10:00:00.000Z"
        memberRole="host"
        userEmail="owner@example.test"
      />,
    );

    expect(screen.getByRole("heading", { name: "ブレストルーム" }));
    expect(screen.getByText("http://localhost:3000/invite/abc123"));
    expect(screen.getByText(/有効期限/));
    expect(screen.getByText(/2026/));
    expect(screen.getByText("host"));
  });
});
