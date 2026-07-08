import { describe, expect, it } from "vitest";
import { getNoteShadow } from "@/app/rooms/[id]/note-shadow";

// box-shadow文字列から各レイヤーのYオフセット(px)を取り出す。
// レイヤーは "0px <y>px <blur>px <spread>px rgba(...)" の形式で始まる前提。
function parseLayerOffsetsY(shadow: string): number[] {
  return shadow.split(/\)\s*,\s*/).map((layer) => {
    const match = layer.trim().match(/^0px\s+(-?[\d.]+)px/);
    if (!match) {
      throw new Error(`影のレイヤー形式が不正: ${layer}`);
    }
    return Number(match[1]);
  });
}

describe("getNoteShadow", () => {
  it("同じ付箋idからは常に同じ影を生成する（決定的）", () => {
    expect(getNoteShadow("note-1")).toBe(getNoteShadow("note-1"));
  });

  it("付箋idごとに浮き量が変わり、影が僅かに異なる", () => {
    expect(getNoteShadow("note-1")).not.toBe(getNoteShadow("note-2"));
  });

  it("すべてのレイヤーが下方向（Yオフセットが0以上）に落ちる", () => {
    const offsets = parseLayerOffsetsY(getNoteShadow("note-1"));
    expect(offsets.length).toBeGreaterThanOrEqual(2);
    for (const offset of offsets) {
      expect(offset).toBeGreaterThanOrEqual(0);
    }
  });

  it("ドラッグ中（isLifted）は浮きが増して影が変わる", () => {
    expect(getNoteShadow("note-1", { isLifted: true })).not.toBe(
      getNoteShadow("note-1"),
    );
  });
});
