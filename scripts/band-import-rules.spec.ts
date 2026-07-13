import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// C′「依存権の帯」規則の機械検査そのものを固定するテスト。
// 帯規則はホワイトリスト型（許可プレフィックス以外の相対 import を全禁止）で
// なければならない。ブラックリスト regex では攻撃的検証で実証された抜け道
// （../index ロンダリング・.././ 等の非正規化パス・barrel 経由の
// "../organisms"・動的 import()）が素通りするため、その 4 種を明示的に
// 違反フィクスチャとして持ち、検知できることを恒久的に保証する。
//
// 実リポジトリを汚さないよう、一時プロジェクトに sgconfig と 5 箱の
// フィクスチャを組み立て、本物のルール（rules/ast-grep）で scan する。

const repoRoot = process.cwd();
const astGrepBin = join(repoRoot, "node_modules/.bin/ast-grep");
const rulesDir = join(repoRoot, "rules/ast-grep");

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

type Finding = {
  ruleId: string;
  file: string;
  text: string;
};

function createProject(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "band-import-rules-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "sgconfig.yml"), `ruleDirs:\n  - ${rulesDir}\n`);
  for (const [path, content] of Object.entries(files)) {
    const filePath = join(dir, path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
  return dir;
}

function scan(projectDir: string): Finding[] {
  const result = spawnSync(astGrepBin, ["scan", "--json", "."], {
    cwd: projectDir,
    encoding: "utf8",
  });
  // ast-grep は違反ありでも --json なら stdout に配列を返す。
  // 実行自体の失敗（設定エラー等）だけを落とす。
  expect(result.error).toBeUndefined();
  expect(result.stdout).not.toBe("");
  const parsed: { ruleId: string; file: string; text: string }[] = JSON.parse(
    result.stdout,
  );
  return parsed.map(({ ruleId, file, text }) => ({ ruleId, file, text }));
}

function findingsFor(findings: Finding[], path: string): Finding[] {
  return findings.filter((finding) => finding.file.endsWith(path));
}

function expectEachDetected(
  findings: Finding[],
  path: string,
  sources: string[],
  ruleIdPattern: RegExp,
) {
  const fileFindings = findingsFor(findings, path);
  for (const source of sources) {
    const hit = fileFindings.find((finding) => finding.text.includes(source));
    expect(hit, `${path} の "${source}" が検知されていない`).toBeDefined();
    expect(hit?.ruleId).toMatch(ruleIdPattern);
  }
}

const BAND_RULE = /^feature-band-/;
const DYNAMIC_RULE = /^no-dynamic-import/;

describe("feature 帯規則（ホワイトリスト型）", () => {
  it("molecules からの上向き・ロンダリング・非正規化・barrel import を検知する", () => {
    const violations = [
      `import { a } from "../containers/board";`,
      `import { b } from "../templates/board-view";`,
      `import { c } from "../organisms/timer";`,
      // 公開境界（feature ルートの index.ts）経由のロンダリング
      `import { d } from "../index";`,
      `import { e } from "..";`,
      // 非正規化パス（TS としては解決されるが正規形でない）
      `import { f } from ".././containers/board";`,
      `import { g } from "..//containers/board";`,
      // barrel 経由（末尾スラッシュなし）
      `import { h } from "../organisms";`,
      // 許可プレフィックスに後続する遡り
      `import { i } from "../logic/../containers/board";`,
      // export 経由の再輸出も import と同じ帯規則に従う
      `export * from "../templates/evil-export";`,
    ];
    const dir = createProject({
      "features/zz-poc/molecules/evil.ts": violations.join("\n"),
    });

    expectEachDetected(
      scan(dir),
      "features/zz-poc/molecules/evil.ts",
      violations.map((line) => line.match(/["'](.+)["']/)?.[1] ?? line),
      BAND_RULE,
    );
  });

  it("molecules の合法 import（同帯・logic・alias・bare module）は検知しない", () => {
    const dir = createProject({
      "features/zz-poc/molecules/legal.ts": [
        `import { s } from "./sibling";`,
        `import { idx } from "./index";`,
        `import { l } from "../logic/util";`,
        `import { btn } from "@/components/ui/button";`,
        `import { notify } from "@/lib/notify";`,
        `import type { Phase } from "@/contracts/room-protocol";`,
        `import * as React from "react";`,
        `import scoped from "@scope/pkg";`,
      ].join("\n"),
    });

    expect(
      findingsFor(scan(dir), "features/zz-poc/molecules/legal.ts"),
    ).toEqual([]);
  });

  it("organisms は templates / containers へ届けない（molecules / logic は合法）", () => {
    const dir = createProject({
      "features/zz-poc/organisms/evil.ts": [
        `import { t } from "../templates/board-view";`,
        `import { c } from "../containers/board";`,
        `import { r } from "../index";`,
      ].join("\n"),
      "features/zz-poc/organisms/legal.ts": [
        `import { m } from "../molecules/dialog";`,
        `import { l } from "../logic/util";`,
        `import { s } from "./sibling";`,
      ].join("\n"),
    });

    const findings = scan(dir);
    expectEachDetected(
      findings,
      "features/zz-poc/organisms/evil.ts",
      ["../templates/board-view", "../containers/board", "../index"],
      BAND_RULE,
    );
    expect(findingsFor(findings, "features/zz-poc/organisms/legal.ts")).toEqual(
      [],
    );
  });

  it("templates は containers へ届けない（organisms / molecules / logic は合法）", () => {
    const dir = createProject({
      "features/zz-poc/templates/evil.ts": [
        `import { c } from "../containers/board";`,
        `import { r } from "..";`,
      ].join("\n"),
      "features/zz-poc/templates/legal.ts": [
        `import { o } from "../organisms/timer";`,
        `import { m } from "../molecules/dialog";`,
        `import { l } from "../logic/util";`,
      ].join("\n"),
    });

    const findings = scan(dir);
    expectEachDetected(
      findings,
      "features/zz-poc/templates/evil.ts",
      ["../containers/board", `".."`],
      BAND_RULE,
    );
    expect(findingsFor(findings, "features/zz-poc/templates/legal.ts")).toEqual(
      [],
    );
  });

  it("containers も公開境界と規約外の箱へは届けない（下の 4 箱は全て合法）", () => {
    const dir = createProject({
      "features/zz-poc/containers/evil.ts": [
        `import { r } from "../index";`,
        `import { u } from "../ui/legacy";`,
      ].join("\n"),
      "features/zz-poc/containers/legal.ts": [
        `import { t } from "../templates/board-view";`,
        `import { o } from "../organisms/timer";`,
        `import { m } from "../molecules/dialog";`,
        `import { l } from "../logic/util";`,
        `import { s } from "./sibling";`,
      ].join("\n"),
    });

    const findings = scan(dir);
    expectEachDetected(
      findings,
      "features/zz-poc/containers/evil.ts",
      ["../index", "../ui/legacy"],
      BAND_RULE,
    );
    expect(
      findingsFor(findings, "features/zz-poc/containers/legal.ts"),
    ).toEqual([]);
  });

  it("logic は最下帯（どの箱の import も禁止、同ディレクトリのみ合法）", () => {
    const dir = createProject({
      "features/zz-poc/logic/evil.ts": [
        `import { m } from "../molecules/dialog";`,
        `import { u } from "../ui/legacy";`,
      ].join("\n"),
      "features/zz-poc/logic/legal.ts": [
        `import { s } from "./sibling";`,
        `import type { Phase } from "@/contracts/room-protocol";`,
      ].join("\n"),
    });

    const findings = scan(dir);
    expectEachDetected(
      findings,
      "features/zz-poc/logic/evil.ts",
      ["../molecules/dialog", "../ui/legacy"],
      BAND_RULE,
    );
    expect(findingsFor(findings, "features/zz-poc/logic/legal.ts")).toEqual([]);
  });

  it("tsx（JSX を含むファイル）でも帯規則が効く", () => {
    const dir = createProject({
      "features/zz-poc/molecules/evil-component.tsx": [
        `import { Board } from "../containers/board";`,
        `export function EvilComponent() {`,
        `  return <Board />;`,
        `}`,
      ].join("\n"),
    });

    expectEachDetected(
      scan(dir),
      "features/zz-poc/molecules/evil-component.tsx",
      ["../containers/board"],
      BAND_RULE,
    );
  });
});

describe("動的 import() の禁止（features / app）", () => {
  it("帯規則の死角になる動的 import() を features 配下で検知する", () => {
    const dir = createProject({
      "features/zz-poc/molecules/dynamic-evil.ts": [
        `export function load() {`,
        `  return import("../containers/board");`,
        `}`,
      ].join("\n"),
      "features/zz-poc/templates/dynamic-evil.tsx": [
        `export function Evil() {`,
        `  const p = import("../containers/board");`,
        `  return <div>{String(p)}</div>;`,
        `}`,
      ].join("\n"),
    });

    const findings = scan(dir);
    expectEachDetected(
      findings,
      "features/zz-poc/molecules/dynamic-evil.ts",
      [`import("../containers/board")`],
      DYNAMIC_RULE,
    );
    expectEachDetected(
      findings,
      "features/zz-poc/templates/dynamic-evil.tsx",
      [`import("../containers/board")`],
      DYNAMIC_RULE,
    );
  });

  it("変数を渡す動的 import() も検知する(静的検査できない経路を形で塞ぐ)", () => {
    const dir = createProject({
      "app/zz-poc/lazy.ts": [
        `export function load(path: string) {`,
        `  return import(path);`,
        `}`,
      ].join("\n"),
    });

    expectEachDetected(
      scan(dir),
      "app/zz-poc/lazy.ts",
      ["import(path)"],
      DYNAMIC_RULE,
    );
  });
});
