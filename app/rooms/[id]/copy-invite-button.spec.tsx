import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyInviteButton } from "@/app/rooms/[id]/copy-invite-button";

function stubClipboard(impl: () => Promise<void>) {
  const writeText = vi.fn(impl);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CopyInviteButton", () => {
  it("クリックで招待URLをクリップボードへ書き込む", async () => {
    const writeText = stubClipboard(() => Promise.resolve());
    render(<CopyInviteButton url="https://idea-flow.example/invite/ABC234" />);

    fireEvent.click(screen.getByRole("button", { name: /コピー/ }));

    expect(writeText).toHaveBeenCalledWith(
      "https://idea-flow.example/invite/ABC234",
    );
  });

  it("コピー成功後は「コピーしました」に変わる", async () => {
    stubClipboard(() => Promise.resolve());
    render(<CopyInviteButton url="https://idea-flow.example/invite/ABC234" />);

    fireEvent.click(screen.getByRole("button", { name: /コピー/ }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /コピーしました/ }),
      ).toBeInTheDocument(),
    );
  });

  it("コピー失敗時はラベルを変えない（成功表示を出さない）", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    render(<CopyInviteButton url="https://idea-flow.example/invite/ABC234" />);

    fireEvent.click(screen.getByRole("button", { name: /コピー/ }));

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /コピーしました/ }),
      ).not.toBeInTheDocument(),
    );
  });
});
