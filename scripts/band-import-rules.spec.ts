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
    // 1 つの import が複数規則に一致することはある（防御の二重化）。
    // 「期待する種別の finding が少なくとも 1 つある」ことを確認する。
    const hit = fileFindings.find(
      (finding) =>
        finding.text.includes(source) && ruleIdPattern.test(finding.ruleId),
    );
    expect(
      hit,
      `${path} の "${source}" が ${ruleIdPattern} で検知されていない`,
    ).toBeDefined();
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

// 帯規則を独立レビューに攻撃的検証させて実証された、import 境界検査の
// 追加の死角。いずれも「静的 import 文以外の経路で上帯 / 公開境界へ到達
// できる」もので、fail-closed に塞ぐ。ここが検知の regression になる。
const COMMONJS_RULE = /^no-commonjs/;
const DOUBLE_SLASH_RULE = /^no-double-slash/;
const JS_ZONE_RULE = /^no-js-family/;
const MODULE_AUG_RULE = /^no-module-augmentation/;
const UNREGISTERED_RULE = /^unregistered-feature/;

describe("攻撃的検証で実証された死角の封鎖", () => {
  it("CommonJS require() は帯規則の死角なので features / app で禁止する", () => {
    const dir = createProject({
      "features/zz-poc/molecules/require-evil.ts": [
        `const secret = require("../containers/board");`,
        `export const leaked = secret.SECRET;`,
      ].join("\n"),
      "app/zz-poc/require-evil.ts": `const x = require("node:fs");\n`,
    });

    const findings = scan(dir);
    expectEachDetected(
      findings,
      "features/zz-poc/molecules/require-evil.ts",
      [`require("../containers/board")`],
      COMMONJS_RULE,
    );
    expectEachDetected(
      findings,
      "app/zz-poc/require-evil.ts",
      [`require("node:fs")`],
      COMMONJS_RULE,
    );
  });

  it("import 〜 = require(...)（import-equals）も禁止する", () => {
    const dir = createProject({
      "features/zz-poc/molecules/import-equals-evil.ts": [
        `import Mod = require("../containers/board");`,
        `export const x = Mod.SECRET;`,
      ].join("\n"),
    });

    expectEachDetected(
      scan(dir),
      "features/zz-poc/molecules/import-equals-evil.ts",
      [`import Mod = require("../containers/board")`],
      COMMONJS_RULE,
    );
  });

  it("import 指定子内の連続スラッシュ（非正規化 alias）を検知する", () => {
    const dir = createProject({
      "features/zz-poc/molecules/double-slash-evil.ts": [
        // no-deep-import の regex をすり抜けた 2 形（feature 名前後の // ）
        `import { a } from "@//features/zz-poc/containers/board";`,
        `import { b } from "@/features/zz-poc//containers/board";`,
      ].join("\n"),
    });

    expectEachDetected(
      scan(dir),
      "features/zz-poc/molecules/double-slash-evil.ts",
      [
        `@//features/zz-poc/containers/board`,
        `@/features/zz-poc//containers/board`,
      ],
      DOUBLE_SLASH_RULE,
    );
  });

  it("JS ファミリ拡張子（.js/.jsx/.mjs/.cjs）は ts/tsx 規則の死角なので features / app で禁止する", () => {
    const dir = createProject({
      "features/zz-poc/molecules/evil.js": `const s = require("../containers/board");\n`,
      "features/zz-poc/molecules/evil.mjs": `import { s } from "../containers/board";\n`,
      "app/zz-poc/evil.jsx": `export const x = 1;\n`,
    });

    const findings = scan(dir);
    for (const path of [
      "features/zz-poc/molecules/evil.js",
      "features/zz-poc/molecules/evil.mjs",
      "app/zz-poc/evil.jsx",
    ]) {
      const hit = findingsFor(findings, path).find((f) =>
        JS_ZONE_RULE.test(f.ruleId),
      );
      expect(
        hit,
        `${path} が TS-only ゾーン規則で検知されていない`,
      ).toBeDefined();
    }
  });

  it("declare module によるモジュール拡張（上帯パスへのコンパイル時結合）を検知する", () => {
    const dir = createProject({
      "features/zz-poc/molecules/augment-evil.ts": [
        `declare module "../containers/board" {`,
        `  export const INJECTED: number;`,
        `}`,
        `export const marker = 1;`,
      ].join("\n"),
    });

    const findings = findingsFor(
      scan(dir),
      "features/zz-poc/molecules/augment-evil.ts",
    );
    expect(
      findings.find((f) => MODULE_AUG_RULE.test(f.ruleId)),
      "declare module が検知されていない",
    ).toBeDefined();
  });

  it("規約に未登録の feature からの feature import を既定拒否する（裸の自 feature alias を含む）", () => {
    // zz-poc は feature-dependencies-one-way.yml に未登録。登録済み 8 feature は
    // 各自の規則で守られているが、新 feature は既定拒否で「登録漏れ = CI エラー」に
    // 顕在化させる（公開境界 index.ts 経由で上帯へ届くロンダリングを塞ぐ）。
    const dir = createProject({
      "features/zz-poc/molecules/self-alias-evil.ts": [
        `import { pub } from "@/features/zz-poc";`,
        `export const stolen = pub;`,
      ].join("\n"),
    });

    expectEachDetected(
      scan(dir),
      "features/zz-poc/molecules/self-alias-evil.ts",
      [`@/features/zz-poc`],
      UNREGISTERED_RULE,
    );
  });
});
