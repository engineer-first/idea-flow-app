import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextPhaseConfirmDialog } from "./next-phase-confirm-dialog";

function setup(
  overrides: Partial<Parameters<typeof NextPhaseConfirmDialog>[0]> = {},
) {
  const props = {
    phase: "phase1" as const,
    disabled: false,
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<NextPhaseConfirmDialog {...props} />);
  return props;
}

describe("NextPhaseConfirmDialog", () => {
  it("トリガーボタンを表示する", () => {
    setup();

    expect(
      screen.getByRole("button", { name: "次のフェーズへ" }),
    ).toBeInTheDocument();
  });

  it("disabled のときトリガーボタンが無効になる", () => {
    setup({ disabled: true });

    expect(
      screen.getByRole("button", { name: "次のフェーズへ" }),
    ).toBeDisabled();
  });

  it("押下で確認ダイアログを開き、現在フェーズのラベルを含む説明を出す", () => {
    setup({ phase: "phase2" });

    fireEvent.click(screen.getByRole("button", { name: "次のフェーズへ" }));

    expect(
      screen.getByText("次のフェーズへ移行しますか？"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("フェーズ2");
  });

  it("「移行する」で onConfirm を呼ぶ（確認前には呼ばない）", () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByRole("button", { name: "次のフェーズへ" }));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "移行する" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("「キャンセル」では onConfirm を呼ばない", () => {
    const { onConfirm } = setup();

    fireEvent.click(screen.getByRole("button", { name: "次のフェーズへ" }));
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
