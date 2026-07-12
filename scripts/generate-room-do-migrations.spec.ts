// workers/room-do-migrations/*.sql から index.ts を生成するスクリプトの
// ロジック部分のテスト。実ファイルシステムには依存させず、ファイル名の
// パース・並び替え・重複検出・出力レンダリングをそれぞれ検証する。
// --check モードだけはスクリプトを丸ごと実行して確認する（一時ディレクトリ使用）。
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectMigrations,
  parseMigrationFileName,
  renderIndexFile,
  sortAndValidate,
} from "./generate-room-do-migrations.mjs";

describe("parseMigrationFileName", () => {
  it("YYYYMMDDHHmmss-slug.sql を timestamp と slug に分解する", () => {
    expect(parseMigrationFileName("20260709094433-note-votes.sql")).toEqual({
      timestamp: "20260709094433",
      slug: "note-votes",
    });
  });

  it("14桁のタイムスタンプで始まらないファイル名には null を返す", () => {
    expect(parseMigrationFileName("note-votes.sql")).toBeNull();
    expect(parseMigrationFileName("2026-note-votes.sql")).toBeNull();
  });

  it(".sql 以外の拡張子には null を返す", () => {
    expect(parseMigrationFileName("20260709094433-note-votes.ts")).toBeNull();
  });
});

describe("sortAndValidate", () => {
  it("timestamp 昇順に並べ替える", () => {
    const entries = [
      { timestamp: "20260709094434", file: "b.sql" },
      { timestamp: "20260708092459", file: "a.sql" },
      { timestamp: "20260709094433", file: "c.sql" },
    ];
    expect(sortAndValidate(entries).map((e) => e.file)).toEqual([
      "a.sql",
      "c.sql",
      "b.sql",
    ]);
  });

  it("timestamp が重複していると、両方のファイル名を含むエラーを投げる", () => {
    const entries = [
      { timestamp: "20260709094433", file: "a.sql" },
      { timestamp: "20260709094433", file: "b.sql" },
    ];
    expect(() => sortAndValidate(entries)).toThrow(/a\.sql/);
    expect(() => sortAndValidate(entries)).toThrow(/b\.sql/);
  });

  it("空配列には空配列を返す", () => {
    expect(sortAndValidate([])).toEqual([]);
  });
});

describe("collectMigrations", () => {
  it("ディレクトリ内の *.sql だけを timestamp 順に読み取る（他拡張子は無視）", () => {
    const files = ["20260709094434-b.sql", "readme.md", "20260708092459-a.sql"];
    const contents: Record<string, string> = {
      "20260709094434-b.sql": "SQL_B",
      "20260708092459-a.sql": "SQL_A",
    };
    const result = collectMigrations({
      readdirSync: () => files,
      readFileSync: (path: string) => contents[path.split("/").pop() as string],
    });

    expect(result.map((m) => ({ file: m.file, sql: m.sql }))).toEqual([
      { file: "20260708092459-a.sql", sql: "SQL_A" },
      { file: "20260709094434-b.sql", sql: "SQL_B" },
    ]);
  });

  it("命名規約に合わないファイルがあると、ファイル名を含むエラーを投げる", () => {
    const result = () =>
      collectMigrations({
        readdirSync: () => ["not-a-migration.sql"],
        readFileSync: () => "",
      });
    expect(result).toThrow(/not-a-migration\.sql/);
  });

  it("SQL が空（コメントのみ）のファイルがあると、ファイル名を含むエラーを投げる", () => {
    // workerd の sql.exec はコメントのみの SQL を実行できず不親切なエラーに
    // なるため、生成段階で「書き忘れ」として分かる形で検出する
    // （new:room-do-migration が作るスタブの書き忘れ対策）。
    const result = () =>
      collectMigrations({
        readdirSync: () => ["20260101000000-todo.sql"],
        readFileSync: () =>
          "-- TODO: このマイグレーションの意図と SQL を書く。\n/* まだ */\n",
      });
    expect(result).toThrow(/20260101000000-todo\.sql/);
  });
});

describe("renderIndexFile", () => {
  it("timestamp 順の {id, sql} 配列と migrateRoomStorage の re-export を含む TypeScript を生成する", () => {
    const output = renderIndexFile([
      {
        timestamp: "20260708092459",
        file: "20260708092459-initial-schema.sql",
        sql: "CREATE TABLE a (id TEXT);",
      },
      {
        timestamp: "20260709094433",
        file: "20260709094433-note-votes.sql",
        sql: "CREATE TABLE b (id TEXT);",
      },
    ]);

    expect(output).toContain(
      "export const ROOM_DO_MIGRATIONS: readonly RoomDoMigration[] = [",
    );
    expect(output).toContain(
      'export { LEGACY_ROOM_DO_MIGRATION_IDS, migrateRoomStorage } from "./apply";',
    );
    // 適用済み管理に使うIDとして、ファイル名の timestamp が埋め込まれること。
    expect(output).toContain('id: "20260708092459"');
    expect(output).toContain('id: "20260709094433"');
    expect(output).toContain("`CREATE TABLE a (id TEXT);`");
    expect(output).toContain("`CREATE TABLE b (id TEXT);`");
    // a (initial-schema) が b (note-votes) より前に来ること。
    expect(output.indexOf("CREATE TABLE a")).toBeLessThan(
      output.indexOf("CREATE TABLE b"),
    );
  });

  it("SQL 内のバッククォートと ${ をエスケープする", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: エスケープ処理そのものを検証するため、意図的に ${ を含む通常の文字列を使う
    const sql = "SELECT '`weird`' , '${not_a_template}';";
    const output = renderIndexFile([
      { timestamp: "20260708092459", file: "20260708092459-tricky.sql", sql },
    ]);
    expect(output).toContain("\\`weird\\`");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: 生成後の文字列にエスケープ済み ${ が含まれることを確認する
    const expected = "\\${not_a_template}";
    expect(output).toContain(expected);
  });

  it("このファイルは自動生成である旨のヘッダーコメントを含む", () => {
    const output = renderIndexFile([]);
    expect(output).toContain("自動生成");
    expect(output).toContain("gen:room-do-migrations");
    // 凍結の境界は「マージ済みか」。未マージの自分の .sql は編集してよい。
    expect(output).toContain("マージ済みの .sql は変更・削除せず");
    expect(output).toContain("未マージ");
  });
});

describe("--check モード", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createProject() {
    const dir = mkdtempSync(join(tmpdir(), "gen-room-do-migrations-"));
    tempDirs.push(dir);
    mkdirSync(join(dir, "scripts"), { recursive: true });
    cpSync(
      join(process.cwd(), "scripts/generate-room-do-migrations.mjs"),
      join(dir, "scripts/generate-room-do-migrations.mjs"),
    );
    mkdirSync(join(dir, "workers/room-do-migrations"), { recursive: true });
    writeFileSync(
      join(dir, "workers/room-do-migrations/20260101000000-example.sql"),
      "CREATE TABLE example (id TEXT);\n",
    );
    return dir;
  }

  function runScript(dir: string, ...args: string[]) {
    // 絶対パスだと macOS の tmpdir シンボリックリンク（/var → /private/var）
    // により process.argv[1] と import.meta.url が食い違い、main ガードが
    // 実行をスキップしてしまう。cwd + 相対パスなら chdir が realpath を返す
    // ため一致する（フック本体の呼び出し方とも同じ形になる）。
    return spawnSync(
      "node",
      ["scripts/generate-room-do-migrations.mjs", ...args],
      { cwd: dir, encoding: "utf8" },
    );
  }

  it("index.ts が未生成でもスタックトレースではなく、生成手順の案内を出して失敗する", () => {
    const dir = createProject();

    const result = runScript(dir, "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("gen:room-do-migrations");
    expect(result.stderr).not.toContain("ENOENT");
  });

  it("生成直後の index.ts は検証を通過する", () => {
    const dir = createProject();

    expect(runScript(dir).status).toBe(0);
    const result = runScript(dir, "--check");

    expect(result.status).toBe(0);
  });
});
