import { describe, expect, it } from "vitest";
import { NOTE_COLOR_STYLES } from "./note-color";

describe("NOTE_COLOR_STYLES", () => {
  it("FigJam風の20色を固定する", () => {
    expect(
      Object.fromEntries(
        Object.entries(NOTE_COLOR_STYLES).map(([color, style]) => [
          color,
          style.backgroundColor,
        ]),
      ),
    ).toEqual({
      yellow: "#FFE299",
      green: "#B3EFBD",
      blue: "#A8DAFF",
      pink: "#FFA8DB",
      orange: "#FFD3A8",
      purple: "#D3BDFF",
      red: "#FFB8A8",
      lime: "#CDF4D3",
      teal: "#B3F4EF",
      cyan: "#C6FAF6",
      indigo: "#C2E5FF",
      violet: "#E4CCFF",
      fuchsia: "#FFC2EC",
      rose: "#FFCDC2",
      amber: "#FFE0C2",
      emerald: "#FFECBD",
      sky: "#D9D9D9",
      slate: "#E6E6E6",
      stone: "#F5EDE2",
      zinc: "#FFFFFF",
    });
  });

  it.each([
    "sky",
    "slate",
    "zinc",
  ] as const)("%s は薄色アバターの視認用境界を持つ", (color) => {
    expect(NOTE_COLOR_STYLES[color].avatarClassName).toContain("border");
  });
});
