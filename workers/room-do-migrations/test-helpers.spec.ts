// test-helpers.ts の dropAllTables が、二重引用符を含むテーブル名でも
// 壊れずに全テーブルを削除できることを確認する。
import { describe, expect, it } from "vitest";
import { runInRoomDO } from "../test-helpers";
import { dropAllTables, tableNames } from "./test-helpers";

describe("dropAllTables", () => {
  it("二重引用符を含むテーブル名も正しくエスケープして削除する", async () => {
    await runInRoomDO("mig-drop-quoted-table", (_instance, state) => {
      dropAllTables(state.storage);
      state.storage.sql.exec(`CREATE TABLE "a""b" (id INTEGER PRIMARY KEY)`);
      expect(tableNames(state.storage)).toContain('a"b');

      dropAllTables(state.storage);

      expect(tableNames(state.storage)).not.toContain('a"b');
    });
  });
});
