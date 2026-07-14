import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeErrorAlert } from "./home-error-alert";

describe("HomeErrorAlert", () => {
  it("role=alert でメッセージを表示する", () => {
    render(<HomeErrorAlert message="ルームが見つかりませんでした。" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ルームが見つかりませんでした。",
    );
  });
});
