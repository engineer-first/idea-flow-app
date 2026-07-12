import { describe, expect, it } from "vitest";
import { tblsSchemaJsonSample } from "@/components/schema-diagrams/schema-details.fixture";
import { TblsSchemaJson } from "@/components/schema-diagrams/tbls-schema";

describe("TblsSchemaJson", () => {
  it("tbls の実出力（indexes / default の省略・未知キー）を受け付け、欠損を正規化する", () => {
    const parsed = TblsSchemaJson.parse(tblsSchemaJsonSample);
    expect(parsed.tables).toHaveLength(1);
    const table = parsed.tables[0];
    expect(table?.name).toBe("room_state");
    // indexes キーが省略されたテーブルは空配列に正規化される
    expect(table?.indexes).toEqual([]);
    expect(table?.columns[1]?.default).toBe("'phase1'");
    expect(table?.constraints[0]?.def).toBe("CHECK (id = 1)");
  });

  it("tables を持たない JSON は受け付けない", () => {
    expect(() => TblsSchemaJson.parse({ name: "x" })).toThrow();
  });

  it("constraints キーが省略されたテーブルは空配列に正規化される", () => {
    const parsed = TblsSchemaJson.parse({
      tables: [
        {
          name: "members",
          columns: [{ name: "user_id", type: "TEXT", nullable: false }],
        },
      ],
    });
    expect(parsed.tables[0]?.constraints).toEqual([]);
  });
});
