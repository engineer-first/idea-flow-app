import type { Note as NoteType } from "../../types/idea";

type NoteProps = {
  note: NoteType;
  selected: boolean;
  isEditing: boolean;
  onClick: () => void;
  onChange: (value: string) => void;
  onToggleEdit: () => void;
  onStartDrag: (event: React.PointerEvent<HTMLElement>) => void;
};

export function Note({
  note,
  selected,
  isEditing,
  onClick,
  onChange,
  onToggleEdit,
  onStartDrag,
}: NoteProps) {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, textarea, input")) return;
    onStartDrag(event);
  };

  return (
    <div
      className={`group absolute min-h-[120px] w-60 rounded-3xl border border-zinc-200 bg-yellow-100 p-4 shadow-lg transition-all hover:shadow-xl ${
        selected ? "ring-2 ring-indigo-500" : ""
      }`}
      style={{ left: note.position.left, top: note.position.top }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={handlePointerDown}
    >
      {isEditing ? (
        <textarea
          value={note.content}
          onChange={(event) => onChange(event.currentTarget.value)}
          onBlur={onToggleEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onToggleEdit();
            }
          }}
          className="h-full w-full resize-none rounded-2xl border border-zinc-300 bg-white p-3 text-sm leading-6 text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          autoFocus
        />
      ) : (
        <div className="cursor-text text-sm leading-6 text-zinc-900">
          {note.content || "ここをクリックして編集"}
        </div>
      )}

      <button
        type="button"
        className="absolute right-3 top-3 rounded-full border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onToggleEdit();
        }}
      >
        編集
      </button>
    </div>
  );
}
