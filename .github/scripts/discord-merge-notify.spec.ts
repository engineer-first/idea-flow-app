import { describe, expect, it } from "vitest";
import {
  buildDiscordPayload,
  truncateFileList,
} from "./discord-merge-notify.js";

describe("truncateFileList", () => {
  it("ファイルがなければ「ファイルなし」を返す", () => {
    expect(truncateFileList([], 1024)).toBe("(ファイルなし)");
  });

  it("上限内に収まる場合はすべて箇条書きで返す", () => {
    const result = truncateFileList(["a.ts", "b.ts", "c.ts"], 1024);
    expect(result).toBe("- a.ts\n- b.ts\n- c.ts");
  });

  it("上限を超える場合は末尾を省略し件数を示す", () => {
    const files = Array.from({ length: 50 }, (_, i) => `file-${i}.ts`);
    const result = truncateFileList(files, 100);

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/…ほか\d+件$/);
  });

  it("1件も入らないほど上限が小さい場合でも件数だけは示す", () => {
    const files = ["very-long-file-name-that-does-not-fit-at-all.ts"];
    const result = truncateFileList(files, 5);

    expect(result).toBe("…ほか1件");
  });
});

describe("buildDiscordPayload", () => {
  it("PR情報からDiscord Embed payloadを組み立てる", () => {
    const payload = buildDiscordPayload({
      number: 215,
      title: "PRマージ時にDiscordへ通知を送る",
      url: "https://github.com/engineer-first/idea-flow-app/pull/215",
      author: "junhat6",
      baseRef: "develop",
      headRef: "feature/215",
      files: ["a.ts", "b.ts"],
    });

    expect(payload).toEqual({
      embeds: [
        {
          title: "#215 PRマージ時にDiscordへ通知を送る",
          url: "https://github.com/engineer-first/idea-flow-app/pull/215",
          description: "`feature/215` → `develop`\nby junhat6",
          color: 0x57f287,
          fields: [
            {
              name: "変更ファイル",
              value: "- a.ts\n- b.ts",
            },
          ],
        },
      ],
    });
  });
});
