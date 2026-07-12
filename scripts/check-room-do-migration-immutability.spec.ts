import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(
  process.cwd(),
  "scripts/check-room-do-migration-immutability.mjs",
);
const tempDirs: string[] = [];

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function createRepository() {
  const dir = mkdtempSync(join(tmpdir(), "room-do-migration-immutability-"));
  tempDirs.push(dir);
  git(dir, "init", "--initial-branch=main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  mkdirSync(join(dir, "workers/room-do-migrations"), { recursive: true });
  writeFileSync(
    join(dir, "workers/room-do-migrations/20260101000000-initial.sql"),
    "CREATE TABLE example (id TEXT);\n",
  );
  git(dir, "add", ".");
  git(dir, "commit", "-m", "base");
  git(dir, "branch", "base");
  return dir;
}

function runCheck(dir: string) {
  return spawnSync("node", [scriptPath, "base"], {
    cwd: dir,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("RoomDO migration immutability check", () => {
  it("新しい .sql ファイルの追加を許可する", () => {
    const dir = createRepository();
    writeFileSync(
      join(dir, "workers/room-do-migrations/20260102000000-next.sql"),
      "ALTER TABLE example ADD COLUMN name TEXT;\n",
    );
    git(dir, "add", ".");
    git(dir, "commit", "-m", "add migration");

    expect(runCheck(dir).status).toBe(0);
  });

  it("ベースに存在する .sql ファイルの変更を拒否する", () => {
    const dir = createRepository();
    writeFileSync(
      join(dir, "workers/room-do-migrations/20260101000000-initial.sql"),
      "CREATE TABLE changed (id TEXT);\n",
    );
    git(dir, "add", ".");
    git(dir, "commit", "-m", "modify migration");

    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("20260101000000-initial.sql");
  });

  it("ベースに存在する .sql ファイルの削除を拒否する", () => {
    const dir = createRepository();
    rmSync(join(dir, "workers/room-do-migrations/20260101000000-initial.sql"));
    git(dir, "add", ".");
    git(dir, "commit", "-m", "delete migration");

    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("20260101000000-initial.sql");
  });

  it("ベースに存在する .sql ファイルの名前変更を拒否する", () => {
    const dir = createRepository();
    git(
      dir,
      "mv",
      "workers/room-do-migrations/20260101000000-initial.sql",
      "workers/room-do-migrations/20260101000000-renamed.sql",
    );
    git(dir, "commit", "-m", "rename migration");

    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("20260101000000-initial.sql");
    expect(result.stderr).toContain("20260101000000-renamed.sql");
  });
});
