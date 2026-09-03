import { IDEA_VALUE_FEASIBILITY_MAP_RANGE } from "@/contracts/board";

export { IDEA_VALUE_FEASIBILITY_MAP_RANGE } from "@/contracts/board";

// アイデアを価値と実現可能性で位置付ける2軸マップの固定表示内容。
// 文言をコンポーネントから分離し、ガイドやラベルの変更箇所を一つに保つ。
export const IDEA_VALUE_FEASIBILITY_MAP_LABELS = {
  ariaLabel: "価値と実現可能性の2軸マップ",
  title: "アイデアの位置付け",
  value: "価値",
  feasibility: "実現可能性",
  low: "低",
  high: "高",
  valueScaleAriaLabel: "価値: 低から高",
  feasibilityScaleAriaLabel: "実現可能性: 低から高",
} as const;

export type IdeaValueFeasibilityPoint = {
  value: number;
  feasibility: number;
};

export type IdeaValueFeasibilityMapPosition = {
  bottom: string;
  left: string;
};

export type IdeaValueFeasibilityMapNotePosition =
  IdeaValueFeasibilityMapPosition & {
    transform: string;
  };

export type IdeaValueFeasibilityMapBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function clampIdeaValueFeasibilityMapCoordinate(
  coordinate: number,
): number {
  if (!Number.isFinite(coordinate)) return IDEA_VALUE_FEASIBILITY_MAP_RANGE.min;
  return Math.min(
    IDEA_VALUE_FEASIBILITY_MAP_RANGE.max,
    Math.max(IDEA_VALUE_FEASIBILITY_MAP_RANGE.min, coordinate),
  );
}

// 将来マップ内の子要素を absolute 配置するときに使う変換。
// 左下を (0, 0)、右上を (100, 100) とし、カテゴリには分割しない。
export function getIdeaValueFeasibilityMapPosition({
  value,
  feasibility,
}: IdeaValueFeasibilityPoint): IdeaValueFeasibilityMapPosition {
  return {
    bottom: `${clampIdeaValueFeasibilityMapCoordinate(value)}%`,
    left: `${clampIdeaValueFeasibilityMapCoordinate(feasibility)}%`,
  };
}

/**
 * マップ端では付箋全体が平面内に収まるよう、座標に応じたtransformを返す。
 */
export function getIdeaValueFeasibilityMapNotePosition(
  point: IdeaValueFeasibilityPoint,
): IdeaValueFeasibilityMapNotePosition {
  const position = getIdeaValueFeasibilityMapPosition(point);
  const feasibility = clampIdeaValueFeasibilityMapCoordinate(point.feasibility);
  const value = clampIdeaValueFeasibilityMapCoordinate(point.value);
  return {
    ...position,
    transform: `translate(${feasibility === 0 ? 0 : feasibility === 100 ? -100 : -50}%, ${value === 0 ? 0 : value === 100 ? 100 : 50}%)`,
  };
}

// マップ平面のクライアント座標を、永続化・配信に使う連続座標へ変換する。
// x は実現可能性（左=0、右=100）、y は価値（下=0、上=100）として反転する。
export function getIdeaValueFeasibilityMapPointFromClientPosition(
  clientX: number,
  clientY: number,
  bounds: IdeaValueFeasibilityMapBounds,
): IdeaValueFeasibilityPoint | null {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (width <= 0 || height <= 0) return null;

  return {
    feasibility: clampIdeaValueFeasibilityMapCoordinate(
      ((clientX - bounds.left) / width) * 100,
    ),
    value: clampIdeaValueFeasibilityMapCoordinate(
      ((bounds.bottom - clientY) / height) * 100,
    ),
  };
}
