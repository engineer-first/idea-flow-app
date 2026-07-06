export type VoteType = "subjective" | "objective";

export type VoteRecord = {
  id: string;
  userId: string;
  stickyNoteId: string;
  voteType: VoteType;
  createdAt: string;
};

export type VoteState = {
  votes: VoteRecord[];
  canVote?: boolean;
};

const SUBJECTIVE_LIMIT = 1;
const OBJECTIVE_LIMIT = 3;
const STORAGE_KEY = "idea-flow-votes";

export function getCurrentUserId() {
  if (typeof window === "undefined") {
    return "local-user-server";
  }

  const existing = window.localStorage.getItem("idea-flow-user-id");
  if (existing) {
    return existing;
  }

  const generated = `local-user-${crypto.randomUUID()}`;
  window.localStorage.setItem("idea-flow-user-id", generated);
  return generated;
}

export function getRemainingVotes(
  votes: VoteRecord[],
  validStickyNoteIds: string[] = [],
) {
  const validIds = new Set(validStickyNoteIds);
  const filteredVotes =
    validStickyNoteIds.length > 0
      ? votes.filter((vote) => validIds.has(vote.stickyNoteId))
      : votes;

  const subjectiveVotes = filteredVotes.filter(
    (vote) => vote.voteType === "subjective",
  );
  const objectiveVotes = filteredVotes.filter(
    (vote) => vote.voteType === "objective",
  );

  return {
    subjective: Math.max(SUBJECTIVE_LIMIT - subjectiveVotes.length, 0),
    objective: Math.max(OBJECTIVE_LIMIT - objectiveVotes.length, 0),
  };
}

export function applyVote(
  state: VoteState,
  vote: VoteRecord,
  validStickyNoteIds: string[] = [],
) {
  const remaining = getRemainingVotes(state.votes, validStickyNoteIds);
  const limitReached =
    vote.voteType === "subjective"
      ? remaining.subjective <= 0
      : remaining.objective <= 0;

  if (limitReached) {
    return { ...state, canVote: false };
  }

  return {
    ...state,
    votes: [...state.votes, vote],
    canVote: true,
  };
}

export function loadVotesFromStorage(): VoteRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return [];
    }

    const parsed = JSON.parse(serialized) as VoteRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVotesToStorage(votes: VoteRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
}
