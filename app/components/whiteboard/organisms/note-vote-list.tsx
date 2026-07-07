import type { NoteTarget, VoteRecord, VoteType } from "../types";

type NoteVoteListProps = {
  dragOverNoteId: string | null;
  draggedVoteId: string | null;
  noteTargets: NoteTarget[];
  votes: VoteRecord[];
  onDragOverNoteChange: (noteId: string | null) => void;
  onMoveVoteToNote: (voteId: string, noteId: string) => void;
  onRemoveVote: (voteId: string) => void;
  onVoteDragEnd: () => void;
  onVoteDragStart: (voteId: string) => void;
};

function getVoteLabel(voteType: VoteType) {
  return voteType === "subjective" ? "主観" : "客観";
}

export function NoteVoteList({
  dragOverNoteId,
  draggedVoteId,
  noteTargets,
  votes,
  onDragOverNoteChange,
  onMoveVoteToNote,
  onRemoveVote,
  onVoteDragEnd,
  onVoteDragStart,
}: NoteVoteListProps) {
  return (
    <div
      style={{
        pointerEvents: "auto",
        display: "grid",
        gap: 12,
        width: "min(900px, calc(100vw - 32px))",
      }}
    >
      <details
        style={{
          background: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: 14,
          color: "#334155",
        }}
      >
        <summary
          style={{
            cursor: noteTargets.length > 0 ? "pointer" : "default",
            fontWeight: 700,
            marginBottom: 10,
            outline: "none",
          }}
        >
          キャンバス上の付箋に投票
        </summary>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          付箋上でドットを確認し、ドラッグで別の付箋に移動できます。
        </div>
        {noteTargets.length === 0 ? (
          <div style={{ marginTop: 10, color: "#475569" }}>
            まだ付箋がありません。左のツールバーまたはペンツールで付箋を追加してください。
          </div>
        ) : (
          <ul
            style={{
              display: "grid",
              gap: 10,
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
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
                <li
                  key={target.noteId}
                  onDragOver={(event) => {
                    event.preventDefault();
                    onDragOverNoteChange(target.noteId);
                  }}
                  onDragLeave={() => onDragOverNoteChange(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!draggedVoteId) {
                      return;
                    }
                    onMoveVoteToNote(draggedVoteId, target.noteId);
                    onDragOverNoteChange(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: 10,
                    background:
                      dragOverNoteId === target.noteId ? "#e0f2fe" : "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    color: "inherit",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {target.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {subjectiveDots.length} / 1 主観, {objectiveDots.length} /
                      3 客観
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {noteVotes.map((vote) => (
                      <span
                        key={vote.id}
                        draggable
                        onDragStart={() => onVoteDragStart(vote.id)}
                        onDragEnd={onVoteDragEnd}
                        role="img"
                        aria-label={`${getVoteLabel(vote.voteType)}ドット`}
                        title={`ドラッグして別の付箋に移動 (${getVoteLabel(
                          vote.voteType,
                        )})`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background:
                            vote.voteType === "subjective"
                              ? "#ef4444"
                              : "#2563eb",
                          color: "#ffffff",
                          fontSize: 12,
                          cursor: "grab",
                          userSelect: "none",
                          pointerEvents: "auto",
                        }}
                      >
                        {vote.voteType === "subjective" ? "S" : "O"}
                      </span>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginTop: 6,
                    }}
                  >
                    {noteVotes.map((vote) => (
                      <button
                        key={`${vote.id}-remove`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveVote(vote.id);
                        }}
                        type="button"
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 999,
                          padding: "4px 8px",
                          background: "#fff",
                          color: "#334155",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        {vote.voteType === "subjective"
                          ? "主観削除"
                          : "客観削除"}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </div>
  );
}
