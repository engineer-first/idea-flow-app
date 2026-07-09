// RoomDO 内蔵 SQLite のマイグレーション版管理のテスト。
// D1 と違い DO はルームごとに独立したストレージを持ち、起床タイミングも
// バラバラなので、「どの版まで適用済みか」を各 DO 自身が記録し、
// 起動時に不足分だけを適用して最新スキーマへ収束できることを検証する。
import { describe, expect, it } from "vitest";
import { migrateRoomStorage, ROOM_DO_MIGRATIONS } from "./room-do-migrations";
import { runInRoomDO } from "./test-helpers";

const USER_A = "11111111-1111-4111-8111-111111111111";

// sqlite 内部テーブルと DO ランタイムの内部テーブル（_cf_KV）を除いた
// ユーザーテーブル名の一覧。
function tableNames(storage: DurableObjectStorage): string[] {
  return storage.sql
    .exec(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       ORDER BY name`,
    )
    .toArray()
    .map((row) => String(row.name));
}

function schemaVersion(storage: DurableObjectStorage): number {
  const rows = storage.sql.exec("SELECT version FROM schema_version").toArray();
  if (rows.length !== 1) {
    throw new Error(`schema_version は1行のはずが ${rows.length} 行`);
  }
  return Number(rows[0]?.version);
}

// テスト前提を作るためにストレージを空にする（constructor が適用済みの
// マイグレーションを含めてすべて破棄する）。
function dropAllTables(storage: DurableObjectStorage): void {
  for (const name of tableNames(storage)) {
    storage.sql.exec(`DROP TABLE IF EXISTS "${name}"`);
  }
  storage.sql.exec("DROP TABLE IF EXISTS schema_version");
}

describe("migrateRoomStorage", () => {
  it("空のストレージに全マイグレーションを適用し、版を記録する", async () => {
    await runInRoomDO("mig-fresh", (_instance, state) => {
      dropAllTables(state.storage);
      migrateRoomStorage(state.storage);
      expect(tableNames(state.storage)).toEqual([
        "members",
        "note_votes",
        "notes",
        "room_owner",
        "room_state",
        "schema_version",
      ]);
      expect(schemaVersion(state.storage)).toBe(ROOM_DO_MIGRATIONS.length);
    });
  });

  it("再実行しても失敗せず、版も変わらない（冪等）", async () => {
    await runInRoomDO("mig-idempotent", (_instance, state) => {
      dropAllTables(state.storage);
      migrateRoomStorage(state.storage);
      migrateRoomStorage(state.storage);
      expect(schemaVersion(state.storage)).toBe(ROOM_DO_MIGRATIONS.length);
    });
  });

  it("版管理導入以前のストレージ（テーブルあり・版記録なし）をデータを保ったまま吸収する", async () => {
    await runInRoomDO("mig-legacy", (_instance, state) => {
      dropAllTables(state.storage);
      // 版管理導入前の constructor が作っていたスキーマを再現する。
      state.storage.sql.exec(
        `CREATE TABLE members (
           user_id TEXT PRIMARY KEY,
           joined_at TEXT NOT NULL DEFAULT (datetime('now'))
         );
         CREATE TABLE notes (
           id TEXT PRIMARY KEY,
           author_id TEXT NOT NULL,
           content TEXT NOT NULL DEFAULT '',
           x REAL NOT NULL,
           y REAL NOT NULL,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL
         );
         CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
      );
      state.storage.sql.exec(
        "INSERT INTO members (user_id) VALUES (?1)",
        USER_A,
      );

      migrateRoomStorage(state.storage);

      expect(schemaVersion(state.storage)).toBe(ROOM_DO_MIGRATIONS.length);
      // 既存データは破壊されない。
      const members = state.storage.sql
        .exec("SELECT user_id FROM members")
        .toArray();
      expect(members).toEqual([{ user_id: USER_A }]);
      // 旧 meta テーブル（招待コードの複製）は掃除される。
      expect(tableNames(state.storage)).not.toContain("meta");
      expect(tableNames(state.storage)).toContain("note_votes");
    });
  });

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

describe("RoomDO constructor の配線", () => {
  it("新規 DO は起動時に最新版までマイグレーションされている", async () => {
    await runInRoomDO("mig-wired", (_instance, state) => {
      expect(schemaVersion(state.storage)).toBe(ROOM_DO_MIGRATIONS.length);
      expect(tableNames(state.storage)).toEqual([
        "members",
        "note_votes",
        "notes",
        "room_owner",
        "room_state",
        "schema_version",
      ]);
    });
  });
});
