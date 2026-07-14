import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NOTE_COLOR_PALETTE } from "@/contracts/room-protocol";
import { NOTE_COLOR_STYLES } from "../logic/note-color";
import { MemberAvatar } from "./member-avatar";

describe("MemberAvatar", () => {
  it.each(NOTE_COLOR_PALETTE)("%s は付箋と同じ背景色を適用する", (color) => {
    render(
      <TooltipProvider>
        <MemberAvatar name={color} color={color} />
      </TooltipProvider>,
    );

    expect(screen.getByLabelText(color)).toHaveStyle({
      backgroundColor: NOTE_COLOR_STYLES[color].backgroundColor,
    });
  });
});
