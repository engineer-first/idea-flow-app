import { z } from "zod";

// tbls が生成する schema.json のうち、SchemaDetails の表示に使う部分の
// コントラクト。tbls はインデックスの無いテーブルで indexes キー自体を、
// デフォルト値の無いカラムで default キー自体を省略するため、ここで
// 欠損を正規化して UI 側を単純に保つ。表示に使わないキーは parse 時に
// 取り除かれる（tbls のバージョンアップでキーが増えても壊れない）。

export const TblsColumn = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean(),
  default: z.string().optional(),
});
export type TblsColumn = z.infer<typeof TblsColumn>;

export const TblsIndex = z.object({
  name: z.string(),
  def: z.string(),
});
export type TblsIndex = z.infer<typeof TblsIndex>;

export const TblsConstraint = z.object({
  name: z.string(),
  type: z.string(),
  def: z.string(),
});
export type TblsConstraint = z.infer<typeof TblsConstraint>;

export const TblsTable = z.object({
  name: z.string(),
  columns: z.array(TblsColumn),
  indexes: z.array(TblsIndex).default([]),
  constraints: z.array(TblsConstraint).default([]),
});
export type TblsTable = z.infer<typeof TblsTable>;

export const TblsSchemaJson = z.object({
  tables: z.array(TblsTable),
});
export type TblsSchemaJson = z.infer<typeof TblsSchemaJson>;
