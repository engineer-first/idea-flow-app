// ForceNextPhaseDialog 単体の仕様。開閉と確認/キャンセルの配線を検証する。
// voting-incomplete エラーからの表示制御は room-board.spec.tsx が担う。
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FORCE_NEXT_PHASE_COPY,
  ForceNextPhaseDialog,
} from "@/app/rooms/[id]/force-next-phase-dialog";

describe("ForceNextPhaseDialog", () => {
  it("open=false では何も表示しない", () => {
    render(
      <ForceNextPhaseDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(FORCE_NEXT_PHASE_COPY.title),
    ).not.toBeInTheDocument();
  });

  it("open=true でタイトルと説明を表示する", () => {
    render(
      <ForceNextPhaseDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText(FORCE_NEXT_PHASE_COPY.title)).toBeInTheDocument();
    expect(
      screen.getByText(FORCE_NEXT_PHASE_COPY.description),
    ).toBeInTheDocument();
  });

  it("「強制的に進む」で onConfirm を呼ぶ", () => {
    const onConfirm = vi.fn();
    render(
      <ForceNextPhaseDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: FORCE_NEXT_PHASE_COPY.confirm }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("キャンセルで onOpenChange(false) を呼び、onConfirm は呼ばない", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ForceNextPhaseDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: FORCE_NEXT_PHASE_COPY.cancel }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
