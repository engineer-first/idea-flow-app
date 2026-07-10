import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-migration-numbers.sh");

const tempDirs: string[] = [];

function createProject(files: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "check-migration-numbers-"));
  tempDirs.push(dir);
  const migrationsDir = join(dir, "workers/migrations");
  mkdirSync(migrationsDir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(migrationsDir, file), "-- test\n");
  }
  return dir;
}

function runScript(projectDir: string) {
  return spawnSync("bash", [scriptPath], {
    cwd: projectDir,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("check-migration-numbers script", () => {
  it("passes when migration numbers are unique", () => {
    const dir = createProject(["0001_lobby.sql", "0002_add_room_expiry.sql"]);

    const result = runScript(dir);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("fails when two files share the same number", () => {
    const dir = createProject([
      "0002_add_room_expiry.sql",
      "0002_add_member_role.sql",
    ]);

    const result = runScript(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("0002");
    expect(result.stderr).toContain("0002_add_room_expiry.sql");
    expect(result.stderr).toContain("0002_add_member_role.sql");
  });

  it("reports every duplicate group when more than one collision exists", () => {
    const dir = createProject([
      "0001_lobby.sql",
      "0001_lobby_alt.sql",
      "0002_add_room_expiry.sql",
      "0002_add_member_role.sql",
    ]);

    const result = runScript(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("0001");
    expect(result.stderr).toContain("0002");
  });

  it("ignores files that are not migrations", () => {
    const dir = createProject(["0001_lobby.sql", "README.md"]);

    const result = runScript(dir);

    expect(result.status).toBe(0);
  });

  it("passes when the migrations directory does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "check-migration-numbers-"));
    tempDirs.push(dir);

    const result = runScript(dir);

    expect(result.status).toBe(0);
  });
});
