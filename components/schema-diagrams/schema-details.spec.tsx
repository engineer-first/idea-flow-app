import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SchemaDetails } from "@/components/schema-diagrams/schema-details";
import { buildSchemaTable } from "@/components/schema-diagrams/schema-details.fixture";

function renderDetails(tables = [buildSchemaTable()]) {
  return render(
    <SchemaDetails
      title="RoomDO (room内部)"
      description="ルーム内部スキーマの詳細"
      tables={tables}
    />,
  );
}

describe("SchemaDetails", () => {
  it("タイトルと説明を表示する", () => {
    renderDetails();
    expect(
      screen.getByRole("heading", { name: "RoomDO (room内部)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ルーム内部スキーマの詳細")).toBeInTheDocument();
  });

  it("テーブルごとにテーブル名の region を表示する", () => {
    renderDetails([
      buildSchemaTable({ name: "notes" }),
      buildSchemaTable({ name: "members" }),
    ]);
    expect(screen.getByRole("region", { name: "notes" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "members" })).toBeInTheDocument();
  });

  it("カラムの名前・型・デフォルト値・NOT NULL を表示する", () => {
    renderDetails();
    const region = screen.getByRole("region", { name: "note_votes" });
    const kindRow = within(region).getByRole("row", { name: /^kind / });
    expect(kindRow).toHaveTextContent("TEXT");
    expect(kindRow).toHaveTextContent("'subjective'");
    expect(kindRow).toHaveTextContent("NOT NULL");
    // nullable なカラムには NOT NULL を表示しない
    const memoRow = within(region).getByRole("row", { name: /^memo/ });
    expect(memoRow).not.toHaveTextContent("NOT NULL");
  });

  it("インデックスの名前と定義を表示する", () => {
    renderDetails();
    const region = screen.getByRole("region", { name: "note_votes" });
    expect(
      within(region).getByText("idx_note_votes_note_kind"),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "CREATE INDEX idx_note_votes_note_kind ON note_votes (note_id, kind)",
      ),
    ).toBeInTheDocument();
  });

  it("インデックスが無いテーブルには「インデックスなし」を表示する", () => {
    renderDetails([buildSchemaTable({ name: "room_state", indexes: [] })]);
    const region = screen.getByRole("region", { name: "room_state" });
    expect(within(region).getByText("インデックスなし")).toBeInTheDocument();
  });

  it("制約の種類と定義を表示する", () => {
    renderDetails();
    const region = screen.getByRole("region", { name: "note_votes" });
    expect(
      within(region).getByText("PRIMARY KEY (note_id)"),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("CHECK (kind IN ('subjective', 'objective'))"),
    ).toBeInTheDocument();
  });
});
