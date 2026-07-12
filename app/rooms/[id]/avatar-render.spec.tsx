import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/app/rooms/[id]/avatar";
import { NOTE_COLOR_STYLES } from "@/components/room-board/molecules/note-color";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NOTE_COLOR_PALETTE } from "@/contracts/room-protocol";

describe("Avatar", () => {
  it.each(NOTE_COLOR_PALETTE)("%s は付箋と同じ背景色を適用する", (color) => {
    render(
      <TooltipProvider>
        <Avatar name={color} color={color} />
      </TooltipProvider>,
    );

    expect(screen.getByLabelText(color)).toHaveStyle({
      backgroundColor: NOTE_COLOR_STYLES[color].backgroundColor,
    });
  });
});
