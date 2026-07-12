// タイムスタンプ付き RoomDO マイグレーションファイルを作成するコマンドの
// テスト。発番ロジック（UTC・衝突回避・slug 検証）は純粋関数として検証し、
// CLI としての振る舞いは一時ディレクトリで丸ごと実行して確認する。
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildMigrationFileName,
  formatUtcTimestamp,
} from "./new-room-do-migration.mjs";

describe("formatUtcTimestamp", () => {
  it("UTC の YYYYMMDDHHmmss を返す（ローカルタイムゾーンに依存しない）", () => {
    expect(formatUtcTimestamp(new Date(Date.UTC(2026, 6, 12, 9, 5, 3)))).toBe(
      "20260712090503",
    );
  });
});

describe("buildMigrationFileName", () => {
  const now = new Date(Date.UTC(2026, 6, 12, 9, 5, 3));

  it("timestamp-slug.sql の形式で組み立てる", () => {
    expect(buildMigrationFileName("add-note-kind", now, [])).toBe(
      "20260712090503-add-note-kind.sql",
    );
  });

  it("同じ秒のファイルが既にあると、秒を進めて衝突を避ける", () => {
    const existing = ["20260712090503-other.sql", "20260712090504-another.sql"];
    expect(buildMigrationFileName("add-note-kind", now, existing)).toBe(
      "20260712090505-add-note-kind.sql",
    );
  });

  it("英小文字・数字・ハイフン以外の説明はエラーにする", () => {
    expect(() => buildMigrationFileName("Add_Note", now, [])).toThrow(
      /add-note-kind/,
    );
    expect(() => buildMigrationFileName("メモ追加", now, [])).toThrow();
  });
});

describe("CLI", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createProject() {
    const dir = mkdtempSync(join(tmpdir(), "new-room-do-migration-"));
    tempDirs.push(dir);
    mkdirSync(join(dir, "scripts"), { recursive: true });
    for (const script of [
      "new-room-do-migration.mjs",
      "generate-room-do-migrations.mjs",
    ]) {
      cpSync(
        join(process.cwd(), "scripts", script),
        join(dir, "scripts", script),
      );
    }
    mkdirSync(join(dir, "workers/room-do-migrations"), { recursive: true });
    return dir;
  }

  function runScript(dir: string, ...args: string[]) {
    // cwd + 相対パスで起動する理由は generate-room-do-migrations.spec.ts を参照
    // （macOS の tmpdir シンボリックリンクと main ガードの食い違い回避）。
    return spawnSync("node", ["scripts/new-room-do-migration.mjs", ...args], {
      cwd: dir,
      encoding: "utf8",
    });
  }

  it("タイムスタンプ付きの .sql スタブを作成し、次の手順を案内する", () => {
    const dir = createProject();

    const result = runScript(dir, "add-note-kind");

    expect(result.status).toBe(0);
    const files = readdirSync(join(dir, "workers/room-do-migrations"));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{14}-add-note-kind\.sql$/);
    const content = readFileSync(
      join(dir, "workers/room-do-migrations", files[0] as string),
      "utf8",
    );
    expect(content).toContain("TODO");
    // SQL を書いたあとの再生成手順を必ず案内する。
    expect(result.stdout).toContain("gen:room-do-migrations");
  });

  it("説明が無いと使い方を出して失敗する", () => {
    const dir = createProject();

    const result = runScript(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("new:room-do-migration");
    expect(readdirSync(join(dir, "workers/room-do-migrations"))).toEqual([]);
  });

  it("規約外の説明はスタックトレースではなくメッセージで失敗する", () => {
    const dir = createProject();

    const result = runScript(dir, "Add_Note");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("add-note-kind");
    expect(result.stderr).not.toContain("at ");
    expect(readdirSync(join(dir, "workers/room-do-migrations"))).toEqual([]);
  });
});
