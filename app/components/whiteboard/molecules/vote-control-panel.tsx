import type {
  NoteTarget,
  RemainingVotes,
  VoteRecord,
  VoteType,
} from "../types";

type VoteControlPanelProps = {
  activeMode: VoteType | null;
  feedback: string;
  noteTargets: NoteTarget[];
  remaining: RemainingVotes;
  selectedNoteId: string | null;
  votes: VoteRecord[];
  onActiveModeChange: (voteType: VoteType) => void;
  onSelectedNoteChange: (noteId: string) => void;
  onVote: () => void;
  onRemoveVoteType: (voteType: VoteType) => void;
};

export function VoteControlPanel({
  activeMode,
  feedback,
  noteTargets,
  remaining,
  selectedNoteId,
  votes,
  onActiveModeChange,
  onSelectedNoteChange,
  onVote,
  onRemoveVoteType,
}: VoteControlPanelProps) {
  return (
    <div
      style={{
        pointerEvents: "auto",
        background: "rgba(255,255,255,0.95)",
        border: "1px solid #d0d7de",
        borderRadius: 12,
        padding: 12,
        width: "min(420px, calc(100vw - 32px))",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>投票状況</div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        主観: 残り{remaining.subjective}票 / 客観: 残り{remaining.objective}票
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => onActiveModeChange("subjective")}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "6px 10px",
            background: activeMode === "subjective" ? "#ef4444" : "#f3f4f6",
            color: activeMode === "subjective" ? "#fff" : "#111827",
            cursor: "pointer",
          }}
        >
          🔴 主観
        </button>
        <button
          type="button"
          onClick={() => onActiveModeChange("objective")}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "6px 10px",
            background: activeMode === "objective" ? "#2563eb" : "#f3f4f6",
            color: activeMode === "objective" ? "#fff" : "#111827",
            cursor: "pointer",
          }}
        >
          🔵 客観
        </button>
        <select
          value={selectedNoteId ?? ""}
          onChange={(event) => onSelectedNoteChange(event.target.value)}
          style={{
            borderRadius: 999,
            padding: "6px 10px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#111827",
            cursor: "pointer",
          }}
        >
          {noteTargets.map((target) => {
            const noteVotes = votes.filter(
              (vote) => vote.stickyNoteId === target.noteId,
            );
            const subjectiveDots = noteVotes.filter(
              (vote) => vote.voteType === "subjective",
            );
            const objectiveDots = noteVotes.filter(
              (vote) => vote.voteType === "objective",
            );
            return (
              <option key={target.noteId} value={target.noteId}>
                {target.title} ({subjectiveDots.length}/1 主観,{" "}
                {objectiveDots.length}/3 客観)
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={onVote}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "6px 10px",
            background: "#22c55e",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          投票する
        </button>
        <button
          type="button"
          onClick={() => onRemoveVoteType("subjective")}
          style={{
            border: "1px solid #ef4444",
            borderRadius: 999,
            padding: "6px 10px",
            background: "#fff",
            color: "#ef4444",
            cursor: "pointer",
          }}
        >
          主観削除
        </button>
        <button
          type="button"
          onClick={() => onRemoveVoteType("objective")}
          style={{
            border: "1px solid #2563eb",
            borderRadius: 999,
            padding: "6px 10px",
            background: "#fff",
            color: "#2563eb",
            cursor: "pointer",
          }}
        >
          客観削除
        </button>
      </div>
      {feedback ? (
        <div style={{ fontSize: 13, marginBottom: 8 }}>{feedback}</div>
      ) : null}
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        付箋を選択して、選択中の投票種別のドットを配置できます。
      </div>
    </div>
  );
}
