import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hookPath = join(process.cwd(), ".claude/hooks/check-boundaries.sh");
const astGrepBin = join(process.cwd(), "node_modules/.bin/ast-grep");

const tempDirs: string[] = [];

function createProject({ withAstGrep = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "check-boundaries-"));
  tempDirs.push(dir);
  cpSync(join(process.cwd(), "sgconfig.yml"), join(dir, "sgconfig.yml"));
  cpSync(join(process.cwd(), "rules"), join(dir, "rules"), {
    recursive: true,
  });
  if (withAstGrep) {
    mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
    symlinkSync(astGrepBin, join(dir, "node_modules/.bin/ast-grep"));
  }
  return dir;
}

function writeProjectFile(dir: string, file: string, content: string) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), content);
  return join(dir, file);
}

function runHook(projectDir: string, filePath?: string) {
  return spawnSync("bash", [hookPath], {
    cwd: projectDir,
    encoding: "utf8",
    input: JSON.stringify({
      tool_input: filePath ? { file_path: filePath } : { content: "x" },
    }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("check-boundaries hook", () => {
  it("allows payloads without a file path", () => {
    const dir = createProject();

    const result = runHook(dir);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("allows workers files that import within workers", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "workers/room-do.ts",
      'import { visibleTo } from "./visibility";\nexport const x = visibleTo;\n',
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("allows app files without workers imports", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "app/rooms/page.ts",
      'import { z } from "zod";\nexport const S = z.string();\n',
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("blocks app files that import workers modules", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "app/rooms/page.ts",
      'import { RoomDO } from "@/workers/room-do";\nexport const x = RoomDO;\n',
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("no-workers-import-outside-workers");
  });

  it("blocks tsx files that import workers via relative paths", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "app/rooms/board.tsx",
      'import { RoomDO } from "../../workers/room-do";\nexport const B = () => <div>{String(RoomDO)}</div>;\n',
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("no-workers-import-outside-workers");
  });

  it("blocks lib files that re-export workers modules", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "lib/room-client/index.ts",
      'export { visibleTo } from "../../workers/visibility";\n',
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("no-workers-import-outside-workers");
  });

  it("blocks spec files that import workers modules", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "app/rooms/page.spec.ts",
      'import { RoomDO } from "@/workers/room-do";\nexport const x = RoomDO;\n',
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("no-workers-import-outside-workers");
  });

  it("skips silently when ast-grep is not installed", () => {
    const dir = createProject({ withAstGrep: false });
    const file = writeProjectFile(
      dir,
      "app/rooms/page.ts",
      'import { RoomDO } from "@/workers/room-do";\nexport const x = RoomDO;\n',
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
