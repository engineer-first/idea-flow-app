import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateRoomSection } from "@/components/home/organisms/create-room-section";

describe("CreateRoomSection", () => {
  it("「ルームを作成」ボタンを描画する", () => {
    render(<CreateRoomSection createRoomAction={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "ルームを作成" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("home-create-room")).toBeInTheDocument();
  });
});
