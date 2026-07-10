import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildNotes } from "@/app/rooms/[id]/board-view.fixture";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";
import type { Note } from "@/app/rooms/notes-reducer";
import {
  calculateVoteTotaling,
  VoteTotalingPanel,
} from "./vote-totaling-panel";

const ME = "11111111-1111-4111-8111-111111111111";

function withVotes(note: Note, subjective: number, objective: number): Note {
  return {
    ...note,
    dotVotes: {
      subjective: { count: subjective, votedByMe: false, ownCount: 0 },
      objective: { count: objective, votedByMe: false, ownCount: 0 },
    },
  };
}

describe("calculateVoteTotaling", () => {
  it("全員分の投票後、主観5点・客観1点で集計し、主観票がある最多点を選ぶ", () => {
    const notes = buildNotes(3).map((note, index) =>
      withVotes(note, [2, 0, 0][index], [1, 5, 0][index]),
    );
    const result = calculateVoteTotaling({ notes, memberCount: 2 });

    expect(result.isComplete).toBe(true);
    expect(result.rows.map((row) => row.score)).toEqual([11, 5, 0]);
    expect(result.selectedChallenge?.noteId).toBe("note-1");
  });

  it("全員分の投票が終わるまでは結果を確定しない", () => {
    const [note] = buildNotes(1);
    const result = calculateVoteTotaling({
      notes: [withVotes(note, 1, 3)],
      memberCount: 2,
    });

    expect(result.isComplete).toBe(false);
    expect(result.selectedChallenge).toBeNull();
  });
});

describe("VoteTotalingPanel", () => {
  it("中央寄せのTOP 3ランキングと取り組む課題を表示する", () => {
    const notes = buildNotes(4).map((note, index) =>
      withVotes(note, [2, 0, 0, 0][index], [1, 5, 0, 0][index]),
    );

    render(<VoteTotalingPanel members={buildMembers(2, ME)} notes={notes} />);

    expect(screen.getByTestId("vote-result-ranking")).toHaveClass("mx-auto");
    expect(screen.getByText("取り組む課題")).toBeInTheDocument();
    expect(screen.getAllByText("TOP 3")).toHaveLength(1);
    expect(
      screen.queryByTestId("vote-totaling-row-note-4"),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("vote-totaling-row-note-1")).getByText("11点"),
    ).toBeInTheDocument();
  });
});
