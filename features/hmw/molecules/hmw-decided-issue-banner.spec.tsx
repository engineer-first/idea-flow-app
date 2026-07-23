import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DECIDED_ISSUE_LABEL } from "../logic/hmw-content";
import { HmwDecidedIssueBanner } from "./hmw-decided-issue-banner";
import { LONG_DECIDED_ISSUE } from "./hmw-decided-issue-banner.fixture";

describe("HmwDecidedIssueBanner", () => {
  it("ラベルと決定課題の本文を表示する", () => {
    render(<HmwDecidedIssueBanner content="宿題を後回しにしてしまう" />);

    expect(screen.getByText(DECIDED_ISSUE_LABEL)).toBeInTheDocument();
    expect(screen.getByText("宿題を後回しにしてしまう")).toBeInTheDocument();
  });

  it("長文でも title 属性で全文が読める", () => {
    render(<HmwDecidedIssueBanner content={LONG_DECIDED_ISSUE} />);

    expect(screen.getByText(LONG_DECIDED_ISSUE)).toHaveAttribute(
      "title",
      LONG_DECIDED_ISSUE,
    );
  });
});
