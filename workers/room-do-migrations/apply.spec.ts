// migrateRoomStorage（DurableObjectStorage への適用処理そのもの）のテスト。
// 実際の ROOM_DO_MIGRATIONS には依存せず、テスト用のマイグレーション配列だけで
// 「未適用IDのみ実行する」「原子性」「fail-closed」「旧・件数方式からの変換」を
// 検証する。ROOM_DO_MIGRATIONS を使った統合的な振る舞いは ./index.spec.ts を参照。
import { describe, expect, it } from "vitest";
import { runInRoomDO } from "../test-helpers";
import { migrateRoomStorage } from "./apply";
import { appliedMigrationIds, dropAllTables, tableNames } from "./test-helpers";

const A = {
  id: "20260101000001",
  sql: "CREATE TABLE t_a (id INTEGER PRIMARY KEY)",
};
const B = {
  id: "20260101000002",
  sql: "CREATE TABLE t_b (id INTEGER PRIMARY KEY)",
};
const C = {
  id: "20260101000003",
  sql: "CREATE TABLE t_c (id INTEGER PRIMARY KEY)",
};
const LEGACY_IDS = [A.id, B.id, C.id];

describe("migrateRoomStorage", () => {
  it("適用済みIDはスキップし、未適用のマイグレーションだけを実行する", async () => {
    await runInRoomDO("mig-pending-only", (_instance, state) => {
      dropAllTables(state.storage);
      migrateRoomStorage(state.storage, [A], LEGACY_IDS);

      // 適用済みIDの SQL を書き換えて再実行しても、再実行されない
      // （実行されたら t_rewritten が生えるので検出できる）。
      const rewritten = {
        id: A.id,
        sql: "CREATE TABLE t_rewritten (id INTEGER PRIMARY KEY)",
      };
      migrateRoomStorage(state.storage, [rewritten, B], LEGACY_IDS);

      const tables = tableNames(state.storage);
      expect(tables).toContain("t_a");
      expect(tables).toContain("t_b");
      expect(tables).not.toContain("t_rewritten");
      expect(appliedMigrationIds(state.storage)).toEqual([A.id, B.id]);
    });
  });

  it("追いつき済みのDOに、より古いIDが後から割り込んでも、未適用分だけを適用する", async () => {
    // 並行開発で B（古いタイムスタンプ）が C（新しいタイムスタンプ）より後に
    // マージされるケース。件数ベースの版管理だと配列内で C の位置がずれ、
    // C を二重適用して B を取りこぼす。IDで追跡していることをここで固定する。
    // （C の再適用は CREATE TABLE の重複エラーとしても検出される。）
    await runInRoomDO("mig-interleaved", (_instance, state) => {
      dropAllTables(state.storage);
      migrateRoomStorage(state.storage, [A, C], LEGACY_IDS);

      migrateRoomStorage(state.storage, [A, B, C], LEGACY_IDS);

      const tables = tableNames(state.storage);
      expect(tables).toContain("t_a");
      expect(tables).toContain("t_b");
      expect(tables).toContain("t_c");
      expect(appliedMigrationIds(state.storage)).toEqual([A.id, B.id, C.id]);
    });
  });

  it("途中で失敗したら適用記録も部分適用も残らない（原子性）", async () => {
    await runInRoomDO("mig-atomic", (_instance, state) => {
      dropAllTables(state.storage);
      migrateRoomStorage(state.storage, [A], LEGACY_IDS);

      const broken = { id: B.id, sql: "THIS IS NOT VALID SQL" };
      expect(() =>
        migrateRoomStorage(state.storage, [A, broken, C], LEGACY_IDS),
      ).toThrow();

      // 失敗したバッチの効果は残らず、適用記録も進まない。
      expect(appliedMigrationIds(state.storage)).toEqual([A.id]);
      expect(tableNames(state.storage)).toContain("t_a");
      expect(tableNames(state.storage)).not.toContain("t_c");
    });
  });

  it("ストレージに、コードが知らない適用済みIDがあると明示的に失敗する（fail-closed）", async () => {
    await runInRoomDO("mig-future", (_instance, state) => {
      dropAllTables(state.storage);
      migrateRoomStorage(state.storage, [A, B], LEGACY_IDS);

      // ロールバックされた古いコード（A までしか知らない）が起きた状況。
      // 未来のスキーマを黙って触って壊すより、明示的に落とす。
      expect(() =>
        migrateRoomStorage(state.storage, [A], LEGACY_IDS),
      ).toThrow();
    });
  });
});

describe("旧・件数方式（schema_version）からの変換", () => {
  it("適用済み件数を先頭からのID列へ変換し、適用済み分は再実行しない", async () => {
    await runInRoomDO("mig-legacy-count", (_instance, state) => {
      dropAllTables(state.storage);
      // 旧方式のストレージを再現する: 1件目適用済み・件数 1 を記録。
      state.storage.sql.exec(A.sql);
      state.storage.sql.exec(
        "CREATE TABLE schema_version (version INTEGER NOT NULL)",
      );
      state.storage.sql.exec("INSERT INTO schema_version (version) VALUES (1)");

      // 変換が「先頭1件は適用済み」と正しく解釈することを、1件目の SQL を
      // 書き換えた配列で検証する（再実行されたら t_rewritten が生える）。
      const rewritten = {
        id: A.id,
        sql: "CREATE TABLE t_rewritten (id INTEGER PRIMARY KEY)",
      };
      migrateRoomStorage(state.storage, [rewritten, B], LEGACY_IDS);

      const tables = tableNames(state.storage);
      expect(tables).not.toContain("t_rewritten");
      expect(tables).toContain("t_b");
      // 旧テーブルは撤去され、以後はID記録に一本化される。
      expect(tables).not.toContain("schema_version");
      expect(appliedMigrationIds(state.storage)).toEqual([A.id, B.id]);
    });
  });

  it("旧・件数がコードの知るマイグレーション数より多いと明示的に失敗する（fail-closed）", async () => {
    await runInRoomDO("mig-legacy-future", (_instance, state) => {
      dropAllTables(state.storage);
      state.storage.sql.exec(
        "CREATE TABLE schema_version (version INTEGER NOT NULL)",
      );
      state.storage.sql.exec("INSERT INTO schema_version (version) VALUES (5)");

      expect(() =>
        migrateRoomStorage(state.storage, [A], LEGACY_IDS),
      ).toThrow();
    });
  });

  it("現在の配列に古いIDが割り込んでも、旧版番号を当時のIDへ変換する", async () => {
    await runInRoomDO("mig-legacy-interleaved", (_instance, state) => {
      dropAllTables(state.storage);
      // 旧方式では A, C の2件がこの順で適用済みだったものとする。
      state.storage.sql.exec(A.sql);
      state.storage.sql.exec(C.sql);
      state.storage.sql.exec(
        "CREATE TABLE schema_version (version INTEGER NOT NULL)",
      );
      state.storage.sql.exec("INSERT INTO schema_version (version) VALUES (2)");

      // ID方式への切替後、古いIDの B が A と C の間へ割り込んだ。
      migrateRoomStorage(state.storage, [A, B, C], [A.id, C.id]);

      expect(tableNames(state.storage)).toContain("t_b");
      expect(appliedMigrationIds(state.storage)).toEqual([A.id, B.id, C.id]);
    });
  });
});
