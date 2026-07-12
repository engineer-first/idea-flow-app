import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StickyNote } from "@/components/room-board/molecules/sticky-note";
import { NOTE_COLOR_PALETTE } from "@/contracts/room-protocol";
import { NOTE_COLOR_STYLES } from "@/features/room-members";

describe("StickyNote", () => {
  it.each(NOTE_COLOR_PALETTE)("%s の背景色を直接適用する", (color) => {
    render(
      <StickyNote noteId={`note-${color}`} color={color} testId="sticky-note">
        本文
      </StickyNote>,
    );

    expect(screen.getByTestId("sticky-note")).toHaveStyle({
      backgroundColor: NOTE_COLOR_STYLES[color].backgroundColor,
    });
  });
});
