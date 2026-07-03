import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hookPath = join(process.cwd(), ".claude/hooks/verify-on-stop.sh");

const tempDirs: string[] = [];

function createRepo({ withTsChange = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "verify-on-stop-"));
  tempDirs.push(dir);
  execSync("git init --quiet", { cwd: dir });
  if (withTsChange) {
    writeFileSync(join(dir, "example.ts"), "export const value = 1;\n");
  }
  return dir;
}

function runHook({
  projectDir,
  verifyCmd,
  stopHookActive = false,
}: {
  projectDir: string;
  verifyCmd: string;
  stopHookActive?: boolean;
}) {
  return spawnSync("bash", [hookPath], {
    cwd: projectDir,
    encoding: "utf8",
    input: JSON.stringify({ stop_hook_active: stopHookActive }),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectDir,
      STOP_VERIFY_CMD: verifyCmd,
    },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("verify-on-stop hook", () => {
  it("skips verification when continuing from a previous stop hook", () => {
    const dir = createRepo({ withTsChange: true });

    const result = runHook({
      projectDir: dir,
      verifyCmd: "exit 1",
      stopHookActive: true,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("skips verification when no TypeScript files changed", () => {
    const dir = createRepo();

    const result = runHook({ projectDir: dir, verifyCmd: "exit 1" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("blocks the stop when verification fails", () => {
    const dir = createRepo({ withTsChange: true });

    const result = runHook({
      projectDir: dir,
      verifyCmd: "echo boom; exit 1",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("boom");
    expect(result.stderr).toContain("Typecheck or tests failed");
  });

  it("allows the stop when verification passes", () => {
    const dir = createRepo({ withTsChange: true });

    const result = runHook({ projectDir: dir, verifyCmd: "exit 0" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
