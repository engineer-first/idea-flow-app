import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DecideNoteAction } from "./decide-note-action";

describe("DecideNoteAction", () => {
  it("付箋の近くに決定ボタンを表示し、押下を親へ通知する", () => {
    const onDecide = vi.fn();
    render(<DecideNoteAction x={120} y={80} onDecide={onDecide} />);

    const button = screen.getByRole("button", {
      name: "これを「取り組む課題」に決定",
    });
    expect(button).toHaveClass("absolute");
    expect(button).toHaveStyle({ left: "120px" });

    fireEvent.click(button);
    expect(onDecide).toHaveBeenCalledTimes(1);
  });

  it("付箋が上端に近いときはボタンの上端が画面外に出ないようクランプする", () => {
    const onDecide = vi.fn();
    render(<DecideNoteAction x={120} y={10} onDecide={onDecide} />);

    const button = screen.getByRole("button", {
      name: "これを「取り組む課題」に決定",
    });
    expect(button).toHaveStyle({ top: "0px" });
  });
});
