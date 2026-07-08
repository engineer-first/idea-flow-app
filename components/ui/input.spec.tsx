// Input コンポーネントの単体テスト。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("data-slot='input' を持つ", () => {
    render(<Input aria-label="text" />);
    expect(screen.getByLabelText("text")).toHaveAttribute("data-slot", "input");
  });

  it("入力値を反映する", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="text" />);
    const input = screen.getByLabelText("text");
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("onChange が呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Input aria-label="text" onChange={onChange} />);
    await user.type(screen.getByLabelText("text"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("disabled で操作できない", () => {
    render(<Input aria-label="text" disabled />);
    expect(screen.getByLabelText("text")).toBeDisabled();
  });
});
