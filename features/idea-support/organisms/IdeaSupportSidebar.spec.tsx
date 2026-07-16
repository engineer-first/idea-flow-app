import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IdeaSupportSidebar } from "./idea-support-sidebar";

describe("IdeaSupportSidebar", () => {
  it("初期状態では発想支援コンテンツを表示する", () => {
    render(<IdeaSupportSidebar />);

    expect(screen.getByText("オズボーンのチェックリスト")).toBeInTheDocument();
  });

  it("閉じるボタンで発想支援コンテンツを非表示にする", () => {
    render(<IdeaSupportSidebar />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(
      screen.queryByText("オズボーンのチェックリスト"),
    ).not.toBeInTheDocument();
  });

  it("閉じた状態から開くボタンで再表示する", () => {
    render(<IdeaSupportSidebar />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    fireEvent.click(screen.getByRole("button", { name: "発想支援を開く" }));

    expect(screen.getByText("オズボーンのチェックリスト")).toBeInTheDocument();
  });
});
