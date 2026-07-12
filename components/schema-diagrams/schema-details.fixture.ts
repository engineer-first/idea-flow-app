import type { TblsTable } from "@/components/schema-diagrams/tbls-schema";

// Schema/SchemaDetails の spec / stories で共有するテストデータビルダー。
// コンポーネントファイル内に生のテストデータを持ち込まないための置き場所。
export function buildSchemaTable(
  overrides: Partial<TblsTable> = {},
): TblsTable {
  return {
    name: "note_votes",
    columns: [
      { name: "note_id", type: "TEXT", nullable: false },
      { name: "kind", type: "TEXT", nullable: false, default: "'subjective'" },
      { name: "memo", type: "TEXT", nullable: true },
    ],
    indexes: [
      {
        name: "idx_note_votes_note_kind",
        def: "CREATE INDEX idx_note_votes_note_kind ON note_votes (note_id, kind)",
      },
    ],
    constraints: [
      { name: "note_id", type: "PRIMARY KEY", def: "PRIMARY KEY (note_id)" },
      {
        name: "-",
        type: "CHECK",
        def: "CHECK (kind IN ('subjective', 'objective'))",
      },
    ],
    ...overrides,
  };
}

// tbls が実際に出力する schema.json の形のサンプル。indexes キーや default
// キーは値が無いと省略され、表示に使わないキー（type / def / driver など）も
// 含まれる。tbls-schema.spec.ts で parse の互換性を検証する。
export const tblsSchemaJsonSample = {
  name: "RoomDO (room内部)",
  desc: "説明",
  tables: [
    {
      name: "room_state",
      type: "table",
      columns: [
        { name: "id", type: "INTEGER", nullable: true },
        { name: "phase", type: "TEXT", nullable: false, default: "'phase1'" },
      ],
      constraints: [
        {
          name: "-",
          type: "CHECK",
          def: "CHECK (id = 1)",
          table: "room_state",
          columns: ["id"],
        },
      ],
      def: "CREATE TABLE room_state (\n  id INTEGER PRIMARY KEY CHECK (id = 1)\n)",
    },
  ],
  relations: [],
  driver: { name: "sqlite", database_version: "3.0.0" },
};
