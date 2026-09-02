import { describe, expect, it } from "vitest";
import {
  getIdeaValueFeasibilityMapPointFromClientPosition,
  getIdeaValueFeasibilityMapPosition,
} from "./idea-value-feasibility-map";

describe("getIdeaValueFeasibilityMapPosition", () => {
  it("価値と実現可能性の0〜100を連続座標へ変換する", () => {
    expect(
      getIdeaValueFeasibilityMapPosition({ value: 0, feasibility: 0 }),
    ).toEqual({ bottom: "0%", left: "0%" });
    expect(
      getIdeaValueFeasibilityMapPosition({ value: 80, feasibility: 65 }),
    ).toEqual({ bottom: "80%", left: "65%" });
    expect(
      getIdeaValueFeasibilityMapPosition({ value: 100, feasibility: 100 }),
    ).toEqual({ bottom: "100%", left: "100%" });
  });

  it("マップ平面上のポインター位置を価値・実現可能性の0〜100へ変換する", () => {
    expect(
      getIdeaValueFeasibilityMapPointFromClientPosition(300, 300, {
        left: 100,
        top: 100,
        right: 500,
        bottom: 500,
      }),
    ).toEqual({ feasibility: 50, value: 50 });
    expect(
      getIdeaValueFeasibilityMapPointFromClientPosition(50, 550, {
        left: 100,
        top: 100,
        right: 500,
        bottom: 500,
      }),
    ).toEqual({ feasibility: 0, value: 0 });
  });

  it("範囲外の座標は0〜100へ収める", () => {
    expect(
      getIdeaValueFeasibilityMapPosition({ value: -1, feasibility: 101 }),
    ).toEqual({ bottom: "0%", left: "100%" });
  });
});
