import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hookPath = join(
  process.cwd(),
  ".claude/hooks/sync-room-do-migrations.sh",
);

const tempDirs: string[] = [];

function createProject() {
  const dir = mkdtempSync(join(tmpdir(), "sync-room-do-migrations-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, "scripts"), { recursive: true });
  cpSync(
    join(process.cwd(), "scripts/generate-room-do-migrations.mjs"),
    join(dir, "scripts/generate-room-do-migrations.mjs"),
  );
  mkdirSync(join(dir, "workers/room-do-migrations"), { recursive: true });
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

describe("sync-room-do-migrations hook", () => {
  it("allows payloads without a file path", () => {
    const dir = createProject();

    const result = runHook(dir);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("ignores files outside workers/room-do-migrations", () => {
    const dir = createProject();
    const file = writeProjectFile(dir, "workers/room-do.ts", "export {};\n");

    const result = runHook(dir, file);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("ignores non-.sql files inside workers/room-do-migrations", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "workers/room-do-migrations/apply.ts",
      "export {};\n",
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("regenerates index.ts when a migration .sql file changes", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "workers/room-do-migrations/20260101000000-example.sql",
      "CREATE TABLE example (id TEXT);\n",
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const generated = readFileSync(
      join(dir, "workers/room-do-migrations/index.ts"),
      "utf8",
    );
    expect(generated).toContain("CREATE TABLE example");
    expect(generated).toContain("ROOM_DO_MIGRATIONS");
  });

  it("blocks with an error message when a migration file name violates the convention", () => {
    const dir = createProject();
    const file = writeProjectFile(
      dir,
      "workers/room-do-migrations/not-a-valid-name.sql",
      "CREATE TABLE example (id TEXT);\n",
    );

    const result = runHook(dir, file);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("not-a-valid-name.sql");
  });
});
