// Tooltip の単体テスト。
// Radix Tooltip はホバー / フォーカス時に portal で body 直下に描画される。
// タイミングに依存するので、waitFor を使って非同期で検証する。
// userEvent のタイマーを advance するために setup の delay を制御する。
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function TestTooltip({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    // テストでは delayDuration=0 で即時表示させる
    <TooltipProvider delayDuration={0}>
      <Tooltip defaultOpen={defaultOpen}>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  it("defaultOpen=true で初期表示時に TooltipContent が出る", () => {
    render(<TestTooltip defaultOpen />);
    // Radix は aria-describedby 用の隠し span も描画するので role="tooltip" で絞る
    expect(screen.getByRole("tooltip")).toHaveTextContent("Tooltip text");
  });

  it("ホバーで TooltipContent が表示される", async () => {
    const user = userEvent.setup();
    render(<TestTooltip />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.hover(screen.getByText("Hover me"));
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Tooltip text");
    });
  });

  it("Trigger に data-slot が付く", () => {
    render(<TestTooltip defaultOpen />);
    const trigger = screen.getByText("Hover me");
    expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger");
  });
});
