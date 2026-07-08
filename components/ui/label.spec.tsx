// Label コンポーネントの単体テスト。
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "@/components/ui/label";

describe("Label", () => {
  it("data-slot='label' を持つ", () => {
    render(<Label>ラベル</Label>);
    expect(screen.getByText("ラベル")).toHaveAttribute("data-slot", "label");
  });

  it("htmlFor で input と関連付けられる", () => {
    render(
      <>
        <Label htmlFor="name">名前</Label>
        <input id="name" />
      </>,
    );
    expect(screen.getByText("名前").tagName).toBe("LABEL");
    expect(screen.getByText("名前")).toHaveAttribute("for", "name");
  });
});
