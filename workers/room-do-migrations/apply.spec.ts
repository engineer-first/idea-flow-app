// migrateRoomStorage（DurableObjectStorage への適用処理そのもの）のテスト。
// 実際の ROOM_DO_MIGRATIONS には依存せず、テスト用の素の SQL 配列だけで
// 「未適用分のみ実行する」「原子性」「fail-closed」を検証する。
// ROOM_DO_MIGRATIONS を使った統合的な振る舞いは ./index.spec.ts を参照。
import { describe, expect, it } from "vitest";
import { runInRoomDO } from "../test-helpers";
import { migrateRoomStorage } from "./apply";
import { dropAllTables, schemaVersion, tableNames } from "./test-helpers";

describe("migrateRoomStorage", () => {
  it("適用済みの版はスキップし、未適用のマイグレーションだけを実行する", async () => {
    await runInRoomDO("mig-pending-only", (_instance, state) => {
      dropAllTables(state.storage);
      const v1 = "CREATE TABLE t_v1 (id INTEGER PRIMARY KEY)";
      migrateRoomStorage(state.storage, [v1]);

      // v1 を書き換えた配列で再実行しても、適用済みの index 0 は再実行されない
      // （実行されたら t_rewritten が生えるので検出できる）。
      const rewritten = "CREATE TABLE t_rewritten (id INTEGER PRIMARY KEY)";
      const v2 = "CREATE TABLE t_v2 (id INTEGER PRIMARY KEY)";
      migrateRoomStorage(state.storage, [rewritten, v2]);

      const tables = tableNames(state.storage);
      expect(tables).toContain("t_v1");
      expect(tables).toContain("t_v2");
      expect(tables).not.toContain("t_rewritten");
      expect(schemaVersion(state.storage)).toBe(2);
    });
  });

  it("途中で失敗したら版更新も部分適用も残らない（原子性）", async () => {
    await runInRoomDO("mig-atomic", (_instance, state) => {
      dropAllTables(state.storage);
      const v1 = "CREATE TABLE t_v1 (id INTEGER PRIMARY KEY)";
      migrateRoomStorage(state.storage, [v1]);

      const broken = "THIS IS NOT VALID SQL";
      expect(() => migrateRoomStorage(state.storage, [v1, broken])).toThrow();

      // 失敗したバッチの効果は残らず、版も進まない。
      expect(schemaVersion(state.storage)).toBe(1);
      expect(tableNames(state.storage)).toContain("t_v1");
    });
  });

  it("ストレージの版がコードの知る版より新しい場合は明示的に失敗する（fail-closed）", async () => {
    await runInRoomDO("mig-future", (_instance, state) => {
      dropAllTables(state.storage);
      const v1 = "CREATE TABLE t_v1 (id INTEGER PRIMARY KEY)";
      const v2 = "CREATE TABLE t_v2 (id INTEGER PRIMARY KEY)";
      migrateRoomStorage(state.storage, [v1, v2]);

      // ロールバックされた古いコード（v1 までしか知らない）が起きた状況。
      // 未来のスキーマを黙って触って壊すより、明示的に落とす。
      expect(() => migrateRoomStorage(state.storage, [v1])).toThrow();
    });
  });
});
