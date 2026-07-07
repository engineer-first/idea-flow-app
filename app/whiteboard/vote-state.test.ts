import { describe, expect, it } from "vitest";
import {
  applyVote,
  getCurrentUserId,
  getRemainingVotes,
  type VoteRecord,
  type VoteState,
} from "./vote-state";

describe("vote-state", () => {
  it("starts with one subjective and three objective votes available", () => {
    const remaining = getRemainingVotes([]);

    expect(remaining.subjective).toBe(1);
    expect(remaining.objective).toBe(3);
  });

  it("records a vote and reduces the remaining balance", () => {
    const vote: VoteRecord = {
      id: "vote-1",
      userId: "user-1",
      stickyNoteId: "note-1",
      voteType: "subjective",
      createdAt: "2026-07-06T00:00:00.000Z",
    };

    const nextState = applyVote({ votes: [] }, vote);

    expect(nextState.votes).toEqual([vote]);
    expect(getRemainingVotes(nextState.votes).subjective).toBe(0);
    expect(getRemainingVotes(nextState.votes).objective).toBe(3);
  });

  it("blocks extra subjective votes after the limit is reached", () => {
    const state: VoteState = {
      votes: [
        {
          id: "vote-1",
          userId: "user-1",
          stickyNoteId: "note-1",
          voteType: "subjective",
          createdAt: "2026-07-06T00:00:00.000Z",
        },
      ],
    };

    const result = applyVote(state, {
      id: "vote-2",
      userId: "user-1",
      stickyNoteId: "note-2",
      voteType: "subjective",
      createdAt: "2026-07-06T00:00:00.000Z",
    } satisfies VoteRecord);

    expect(result.votes).toHaveLength(1);
    expect(result.canVote).toBe(false);
  });

  it("provides a stable user id for persistence", () => {
    const first = getCurrentUserId();
    const second = getCurrentUserId();

    expect(first).toBe(second);
    expect(first).toMatch(/^local-user-/);
  });
});
