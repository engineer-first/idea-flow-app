// workers/room-do-migrations/*.sql から index.ts を生成するスクリプトの
// ロジック部分のテスト。実ファイルシステムには依存させず、ファイル名の
// パース・並び替え・重複検出・出力レンダリングをそれぞれ検証する。
import { describe, expect, it } from "vitest";
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
});

describe("renderIndexFile", () => {
  it("timestamp 順の SQL 配列と migrateRoomStorage の re-export を含む TypeScript を生成する", () => {
    const output = renderIndexFile([
      {
        file: "20260708092459-initial-schema.sql",
        sql: "CREATE TABLE a (id TEXT);",
      },
      {
        file: "20260709094433-note-votes.sql",
        sql: "CREATE TABLE b (id TEXT);",
      },
    ]);

    expect(output).toContain(
      "export const ROOM_DO_MIGRATIONS: readonly string[] = [",
    );
    expect(output).toContain('export { migrateRoomStorage } from "./apply";');
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
      { file: "20260708092459-tricky.sql", sql },
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
  });
});
