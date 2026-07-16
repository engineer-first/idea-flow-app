import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IdeaSupportSidebar } from "./idea-support-sidebar";

describe("IdeaSupportSidebar", () => {
  it("初期状態では発想支援コンテンツを表示しない", () => {
    render(<IdeaSupportSidebar />);

    expect(
      screen.queryByText("オズボーンのチェックリスト"),
    ).not.toBeInTheDocument();
  });

  it("開くボタンで発想支援コンテンツを表示する", () => {
    render(<IdeaSupportSidebar />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "発想支援を開く",
      }),
    );

    expect(screen.getByText("オズボーンのチェックリスト")).toBeInTheDocument();
  });

  it("開いた状態から閉じるボタンで再度非表示にする", () => {
    render(<IdeaSupportSidebar />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "発想支援を開く",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "発想支援を閉じる",
      }),
    );

    expect(
      screen.queryByText("オズボーンのチェックリスト"),
    ).not.toBeInTheDocument();
  });
});
