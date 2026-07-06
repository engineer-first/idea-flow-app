import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyInviteButton } from "@/app/rooms/[inviteCode]/copy-invite-button";

describe("CopyInviteButton", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  it("招待URLをクリップボードへコピーする", async () => {
    render(
      <CopyInviteButton inviteUrl="http://localhost:3000/invite/abc123" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "招待URLをコピー" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://localhost:3000/invite/abc123",
    );
    expect(await screen.findByText("コピーしました")).toBeTruthy();
  });

  it("コピー失敗時に失敗状態を表示する", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
      new Error("denied"),
    );

    render(
      <CopyInviteButton inviteUrl="http://localhost:3000/invite/abc123" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "招待URLをコピー" }));

    expect(await screen.findByText("コピーできませんでした")).toBeTruthy();
  });
});
