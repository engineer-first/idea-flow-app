import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// PROJECT_DIR は CLAUDE_PROJECT_DIR (未設定時は pwd) から決まるため、対象ファイルは
// 実プロジェクトツリー配下 (tmp/format-on-edit-spec-*) に置く必要がある。
//
// bash -> scripts/format-file.sh -> npx biome/remark と実プロセスを spawn する
// ため、フルスイート実行時の並列負荷が高いとデフォルトの 5000ms を超えることが
// ある。ロジックの不具合ではなく実プロセス起動のオーバーヘッドによるものなので、
// 余裕を持たせる。さらに、多数の spec ファイルが並行して実プロセスを spawn する
// 環境ではまれに transient な spawn 失敗が起きうる (単独実行では再現しない) ため
// retry する。
vi.setConfig({ testTimeout: 15000, retry: 2 });

const projectDir = process.cwd();
const hookPath = ".claude/hooks/format-on-edit.sh";
const tmpRoot = join(projectDir, "tmp");

const createdDirs: string[] = [];

function createScratchDir() {
  mkdirSync(tmpRoot, { recursive: true });
  const dir = mkdtempSync(join(tmpRoot, "format-on-edit-spec-"));
  createdDirs.push(dir);
  return dir;
}

function runHook(filePath: string | undefined) {
  return spawnSync("bash", [hookPath], {
    cwd: projectDir,
    encoding: "utf8",
    input: JSON.stringify({
      tool_input: filePath === undefined ? {} : { file_path: filePath },
    }),
  });
}

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe(".claude/hooks/format-on-edit.sh", () => {
  it("formats a Markdown file with remark in place, without emptying it", () => {
    const dir = createScratchDir();
    const file = join(dir, "note.md");
    writeFileSync(file, "# Title\n\n* item one\n* item two\n");

    const result = runHook(file);

    expect(result.status).toBe(0);
    const formatted = readFileSync(file, "utf8");
    expect(formatted).not.toBe("");
    expect(formatted).toContain("- item one");
  });

  it("formats a TypeScript file with biome", () => {
    const dir = createScratchDir();
    const file = join(dir, "sample.ts");
    writeFileSync(file, "export const greeting = 'hello';\n");

    const result = runHook(file);

    expect(result.status).toBe(0);
    expect(readFileSync(file, "utf8")).toContain('"hello"');
  });

  it("skips AGENTS.md", () => {
    const dir = createScratchDir();
    const file = join(dir, "AGENTS.md");
    const original = "* not-a-guideline-bullet\n";
    writeFileSync(file, original);

    const result = runHook(file);

    expect(result.status).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(original);
  });

  it("skips files outside the project directory", () => {
    const result = runHook("/etc/hosts");

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("does nothing when the payload has no file_path", () => {
    const result = runHook(undefined);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
