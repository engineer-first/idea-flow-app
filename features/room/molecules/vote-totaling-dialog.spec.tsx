import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildMembers, buildNotes } from "@/contracts/room-protocol.fixture";
import { VoteTotalingDialog } from "./vote-totaling-dialog";

const ME = "11111111-1111-4111-8111-111111111111";

function setup(
  overrides: Partial<Parameters<typeof VoteTotalingDialog>[0]> = {},
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    isVotingComplete: true,
    members: buildMembers(2, ME),
    notes: buildNotes(3),
    ...overrides,
  };
  render(<VoteTotalingDialog {...props} />);
  return props;
}

describe("VoteTotalingDialog", () => {
  it("open のとき投票結果パネルをダイアログで表示する", () => {
    setup();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("vote-result-ranking")).toBeInTheDocument();
  });

  it("open=false のときは何も表示しない", () => {
    setup({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("閉じる操作で onOpenChange(false) を呼ぶ（ボードに戻って話し合える）", () => {
    const { onOpenChange } = setup();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
