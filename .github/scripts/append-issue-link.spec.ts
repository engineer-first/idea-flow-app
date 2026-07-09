import { describe, expect, it } from "vitest";
import {
  buildBodyWithIssueLink,
  extractIssueNumber,
} from "./append-issue-link.js";

describe("extractIssueNumber", () => {
  it("ブランチ名から issue 番号を抽出する", () => {
    expect(extractIssueNumber("feature/104")).toBe("104");
  });

  it("番号を含まないブランチ名では null を返す", () => {
    expect(extractIssueNumber("feature/no-number")).toBeNull();
  });

  it("空のブランチ名では null を返す", () => {
    expect(extractIssueNumber("")).toBeNull();
  });
});

describe("buildBodyWithIssueLink", () => {
  it("現在の body に Closes マーカーを追記する", () => {
    const result = buildBodyWithIssueLink("元のdescription", "104");
    expect(result).toBe(
      "元のdescription\n\n<!-- issue-ref:104 -->\nCloses #104",
    );
  });

  it("PATCH直前に取得した最新の body を基準に追記する（stale な body には追記しない）", () => {
    const staleBody = "PR作成直後のbody";
    const liveBody = "PR作成者が書き直した最新のbody";

    const result = buildBodyWithIssueLink(liveBody, "104");

    expect(result).toContain(liveBody);
    expect(result).not.toContain(staleBody);
  });

  it("マーカーが既に存在する場合は null を返し上書きしない", () => {
    const body = "説明\n\n<!-- issue-ref:104 -->\nCloses #104";
    expect(buildBodyWithIssueLink(body, "104")).toBeNull();
  });

  it("空文字の body は空文字として扱う", () => {
    const result = buildBodyWithIssueLink("", "104");
    expect(result).toBe("\n\n<!-- issue-ref:104 -->\nCloses #104");
  });

  it("null/undefined の body は空文字として扱う", () => {
    expect(buildBodyWithIssueLink(null, "104")).toBe(
      "\n\n<!-- issue-ref:104 -->\nCloses #104",
    );
    expect(buildBodyWithIssueLink(undefined, "104")).toBe(
      "\n\n<!-- issue-ref:104 -->\nCloses #104",
    );
  });
});
