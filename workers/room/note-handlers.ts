// note:* メッセージのハンドラ。各ハンドラは
// 「認可（author / 可視性）→ 保存 → 配信 → 必要なら自動再編成」の順で閉じる。
import {
  NOTE_SPAWN_JITTER,
  NOTE_SPAWN_X_MIN,
  NOTE_SPAWN_Y_MIN,
} from "../../contracts/board";
import { autoReorganize } from "./groups";
import { type MessageHandlers, replyForbidden } from "./handler-context";
import { getMemberColor } from "./members";
import {
  broadcastNoteInserted,
  broadcastNoteUpdated,
  canEdit,
  deleteNote,
  findNote,
  insertNote,
  isVisibleTo,
  moveNote,
  type NoteRow,
  publishNote,
  requireNote,
  toProtocolNote,
  touchNote,
  unpublishNote,
  updateNoteContent,
} from "./notes";
import {
  addUserNoteVote,
  countUserNoteVotes,
  deleteNoteVotes,
  hasReachedVoteLimit,
  removeUserNoteVotes,
} from "./votes";

export const noteHandlers: MessageHandlers<
  | "note:create"
  | "note:publish"
  | "note:unpublish"
  | "note:update-content"
  | "note:move"
  | "note:drag"
  | "note:delete"
  | "note:vote"
  | "note:vote-reset"
> = {
  "note:create": (ctx) => {
    const now = new Date().toISOString();
    const color = getMemberColor(ctx.sql, ctx.userId) ?? "yellow";

    const note: NoteRow = {
      id: crypto.randomUUID(),
      author_id: ctx.userId,
      content: "",
      visibility: "private",
      color: color,
      x: NOTE_SPAWN_X_MIN + Math.random() * NOTE_SPAWN_JITTER,
      y: NOTE_SPAWN_Y_MIN + Math.random() * NOTE_SPAWN_JITTER,
      created_at: now,
      updated_at: now,
    };
    insertNote(ctx.sql, note);
    broadcastNoteInserted(ctx.sql, ctx.broadcaster, note);
  },

  "note:publish": (ctx, message) => {
    const row = requireNote(ctx, message.noteId);
    if (!row) return;
    if (row.author_id !== ctx.userId || row.visibility !== "private") {
      replyForbidden(ctx);
      return;
    }
    const updatedAt = new Date().toISOString();
    publishNote(ctx.sql, message.noteId, message.x, message.y, updatedAt);
    broadcastNoteInserted(ctx.sql, ctx.broadcaster, {
      ...row,
      visibility: "shared",
      x: message.x,
      y: message.y,
      updated_at: updatedAt,
    });
    autoReorganize(ctx.storage, ctx.broadcaster);
  },

  "note:unpublish": (ctx, message) => {
    const row = requireNote(ctx, message.noteId);
    if (!row) return;
    if (row.author_id !== ctx.userId || row.visibility !== "shared") {
      replyForbidden(ctx);
      return;
    }
    // shared の行を消す通知は、可視性を変える前に全メンバーへ送る。
    ctx.broadcaster.broadcast(
      { type: "note:deleted", noteId: message.noteId },
      toProtocolNote(ctx.sql, row, ctx.userId),
    );
    const updatedAt = new Date().toISOString();
    unpublishNote(ctx.sql, message.noteId, updatedAt);
    // private 化後は作者だけに同じIDの付箋を復帰させる。
    broadcastNoteInserted(ctx.sql, ctx.broadcaster, {
      ...row,
      visibility: "private",
      updated_at: updatedAt,
    });
    autoReorganize(ctx.storage, ctx.broadcaster);
  },

  "note:update-content": (ctx, message) => {
    const row = requireNote(ctx, message.noteId);
    if (!row) return;
    if (!canEdit(row, ctx.userId)) {
      replyForbidden(ctx);
      return;
    }
    const updatedAt = new Date().toISOString();
    updateNoteContent(ctx.sql, message.noteId, message.content, updatedAt);
    broadcastNoteUpdated(ctx.sql, ctx.broadcaster, {
      ...row,
      content: message.content,
      updated_at: updatedAt,
    });
  },

  "note:move": (ctx, message) => {
    const row = requireNote(ctx, message.noteId);
    if (!row) return;
    if (!canEdit(row, ctx.userId)) {
      replyForbidden(ctx);
      return;
    }
    const updatedAt = new Date().toISOString();
    moveNote(ctx.sql, message.noteId, message.x, message.y, updatedAt);
    broadcastNoteUpdated(ctx.sql, ctx.broadcaster, {
      ...row,
      x: message.x,
      y: message.y,
      updated_at: updatedAt,
    });

    // 位置が変わったので自動再編成を実行
    autoReorganize(ctx.storage, ctx.broadcaster);
  },

  // ドラッグ中の座標は永続化せず、送信者以外の可視な相手へ中継するだけ。
  "note:drag": (ctx, message) => {
    const row = findNote(ctx.sql, message.noteId);
    if (!row) {
      return;
    }
    if (!canEdit(row, ctx.userId)) {
      replyForbidden(ctx);
      return;
    }
    if (row.visibility === "private") {
      return;
    }
    ctx.broadcaster.broadcast(
      {
        type: "note:drag",
        noteId: message.noteId,
        x: message.x,
        y: message.y,
      },
      toProtocolNote(ctx.sql, row, ctx.userId),
      ctx.ws,
    );
  },

  "note:delete": (ctx, message) => {
    const row = requireNote(ctx, message.noteId);
    if (!row) return;
    if (row.author_id !== ctx.userId) {
      replyForbidden(ctx);
      return;
    }
    deleteNote(ctx.sql, message.noteId);
    deleteNoteVotes(ctx.sql, message.noteId);
    ctx.broadcaster.broadcast(
      { type: "note:deleted", noteId: message.noteId },
      toProtocolNote(ctx.sql, row, ctx.userId),
    );

    // 付箋が削除されたので自動再編成を実行
    autoReorganize(ctx.storage, ctx.broadcaster);
  },

  "note:vote": (ctx, message) => {
    const row = requireNote(ctx, message.noteId);
    if (!row) return;
    if (!isVisibleTo(row, ctx.userId)) {
      replyForbidden(ctx);
      return;
    }

    const ownCount = countUserNoteVotes(
      ctx.sql,
      message.noteId,
      ctx.userId,
      message.kind,
    );
    // 主観投票は同じ付箋への再投票でトグル解除になる。
    if (message.kind === "subjective" && ownCount > 0) {
      removeUserNoteVotes(ctx.sql, message.noteId, ctx.userId, message.kind);
    } else {
      if (hasReachedVoteLimit(ctx.sql, ctx.userId, message.kind)) {
        ctx.reply({
          type: "error",
          code: "forbidden",
          message: "投票上限を超えています。",
        });
        return;
      }
      addUserNoteVote(ctx.sql, message.noteId, ctx.userId, message.kind);
    }

    const updatedAt = new Date().toISOString();
    touchNote(ctx.sql, message.noteId, updatedAt);
    broadcastNoteUpdated(ctx.sql, ctx.broadcaster, {
      ...row,
      updated_at: updatedAt,
    });
  },

  "note:vote-reset": (ctx, message) => {
    const row = requireNote(ctx, message.noteId);
    if (!row) return;
    if (!isVisibleTo(row, ctx.userId)) {
      replyForbidden(ctx);
      return;
    }

    removeUserNoteVotes(ctx.sql, message.noteId, ctx.userId, message.kind);

    const updatedAt = new Date().toISOString();
    touchNote(ctx.sql, message.noteId, updatedAt);
    broadcastNoteUpdated(ctx.sql, ctx.broadcaster, {
      ...row,
      updated_at: updatedAt,
    });
  },
};
