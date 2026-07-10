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
    expect(result.selectedChallenges.map((row) => row.noteId)).toEqual([
      "note-1",
    ]);
  });

  it("全員分の投票が終わるまでは結果を確定しない", () => {
    const [note] = buildNotes(1);
    const result = calculateVoteTotaling({
      notes: [withVotes(note, 1, 3)],
      memberCount: 2,
    });

    expect(result.isComplete).toBe(false);
    expect(result.selectedChallenges).toEqual([]);
  });

  it("総ポイント同率なら主観票を優先し、同率首位をすべて選ぶ", () => {
    const votes = [
      [2, 3],
      [2, 3],
      [2, 3],
      [1, 8],
      [0, 13],
      [1, 0],
      [1, 0],
      [1, 0],
    ];
    const notes = buildNotes(8).map((note, index) =>
      withVotes(note, votes[index][0], votes[index][1]),
    );

    const result = calculateVoteTotaling({ notes, memberCount: 10 });

    expect(result.isComplete).toBe(true);
    expect(result.rows.slice(0, 5).map((row) => row.score)).toEqual([
      13, 13, 13, 13, 13,
    ]);
    expect(result.selectedChallenges.map((row) => row.noteId)).toEqual([
      "note-1",
      "note-2",
      "note-3",
    ]);
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

  it("同率首位をすべて取り組む課題として列挙し、ランキングも同率1位にする", () => {
    const votes = [
      [2, 3],
      [2, 3],
      [2, 3],
      [1, 8],
      [0, 13],
      [1, 0],
      [1, 0],
      [1, 0],
    ];
    const notes = buildNotes(8).map((note, index) =>
      withVotes(note, votes[index][0], votes[index][1]),
    );

    render(<VoteTotalingPanel members={buildMembers(10, ME)} notes={notes} />);

    expect(screen.getAllByText("1位")).toHaveLength(3);
    expect(screen.getAllByText("付箋 1")).toHaveLength(2);
    expect(screen.getAllByText("付箋 2")).toHaveLength(2);
    expect(screen.getAllByText("付箋 3")).toHaveLength(2);
    expect(screen.queryByText("付箋 4")).not.toBeInTheDocument();
  });
});
