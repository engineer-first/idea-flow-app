import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkFeatureLayout } from "./check-feature-layout.mts";

// feature 内ディレクトリ構成の機械検査。C′ 移行後の 2 つの不変条件を固定する:
// 1. feature 単位で「フラット or 5 箱」の二択（規約外ディレクトリは fail-closed。
//    旧層 ui/ も移行完了により規約外）。
// 2. 箱は入れ子にしない（feature 内は深さ 2 まで）。帯規則
//    （feature-band-imports.yml）の files glob と regex はこの前提に依存する。

describe("checkFeatureLayout（純関数）", () => {
  it("5 箱構成（箱の一部だけ使うのも合法）", () => {
    expect(
      checkFeatureLayout({
        name: "room",
        paths: [
          "index.ts",
          "containers/room-board.tsx",
          "templates/room-board-view.tsx",
          "organisms/room-timer.tsx",
          "molecules/leave-confirm-dialog.tsx",
          "molecules/leave-confirm-dialog.stories.tsx",
          "logic/room-reducer.ts",
        ],
      }),
    ).toEqual([]);
  });

  it("フラット構成（root に実装 + index.ts）は合法", () => {
    expect(
      checkFeatureLayout({
        name: "dot-vote",
        paths: [
          "index.ts",
          "dot-vote-button.tsx",
          "dot-vote-button.stories.tsx",
        ],
      }),
    ).toEqual([]);
  });

  it("logic/ だけの feature は合法", () => {
    expect(
      checkFeatureLayout({
        name: "invite",
        paths: ["index.ts", "logic/invite-url.ts"],
      }),
    ).toEqual([]);
  });

  it("旧層 ui/ は規約外として fail（C′ 移行完了後の語彙は 5 箱のみ）", () => {
    const violations = checkFeatureLayout({
      name: "room",
      paths: ["index.ts", "ui/room-board.tsx"],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("unknown-subdirectory");
    expect(violations[0]?.feature).toBe("room");
    expect(violations[0]?.path).toBe("ui/room-board.tsx");
  });

  it("規約外のサブディレクトリは fail（fail-closed）", () => {
    const violations = checkFeatureLayout({
      name: "room",
      paths: ["index.ts", "helpers/format.ts"],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("unknown-subdirectory");
    expect(violations[0]?.path).toBe("helpers/format.ts");
  });

  it("大文字違いの箱名も規約外として fail（大文字小文字を区別する）", () => {
    const violations = checkFeatureLayout({
      name: "room",
      paths: ["index.ts", "Molecules/dialog.tsx"],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("unknown-subdirectory");
  });

  it("箱がある feature の root には index.ts 以外を置けない（フラット or 5 箱の二択）", () => {
    const violations = checkFeatureLayout({
      name: "room",
      paths: ["index.ts", "stray-helper.ts", "molecules/dialog.tsx"],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("root-file-beside-layers");
    expect(violations[0]?.path).toBe("stray-helper.ts");
  });

  it("箱の中の入れ子ディレクトリは fail（深さ 2 まで）", () => {
    const violations = checkFeatureLayout({
      name: "room",
      paths: ["index.ts", "molecules/nested/dialog.tsx"],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("nested-subdirectory");
    expect(violations[0]?.path).toBe("molecules/nested/dialog.tsx");
  });

  it("違反は 1 feature に複数あれば全部列挙する", () => {
    const violations = checkFeatureLayout({
      name: "room",
      paths: [
        "index.ts",
        "ui/legacy.tsx",
        "molecules/dialog.tsx",
        "helpers/format.ts",
        "molecules/nested/deep.tsx",
      ],
    });
    expect(violations.map((v) => v.kind).sort()).toEqual([
      "nested-subdirectory",
      "unknown-subdirectory",
      "unknown-subdirectory",
    ]);
  });
});

describe("check-feature-layout CLI", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createFeatures(files: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), "check-feature-layout-"));
    tempDirs.push(dir);
    for (const file of files) {
      const filePath = join(dir, "features", file);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, "export {};\n");
    }
    return dir;
  }

  function runScript(rootDir: string) {
    return spawnSync(
      "node",
      [
        "--no-warnings",
        join(process.cwd(), "scripts/check-feature-layout.mts"),
      ],
      { cwd: rootDir, encoding: "utf8" },
    );
  }

  it("合法な構成では exit 0", () => {
    const dir = createFeatures([
      "room/index.ts",
      "room/containers/room-board.tsx",
      "room/logic/room-reducer.ts",
      "dot-vote/index.ts",
      "dot-vote/dot-vote-button.tsx",
    ]);

    const result = runScript(dir);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("違反があると exit 1 で feature 名とパスを報告する", () => {
    const dir = createFeatures([
      "room/index.ts",
      "room/ui/legacy.tsx",
      "room/molecules/dialog.tsx",
    ]);

    const result = runScript(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("room");
    expect(result.stderr).toContain("unknown-subdirectory");
  });
});
