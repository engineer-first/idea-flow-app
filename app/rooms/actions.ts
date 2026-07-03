"use server";

// ルーム作成/参加、付箋のCRUDをまとめたServer Actions境界。
// 認可はRLS + RPC（create_room/join_room）に任せ、ここでは
// 「認証されているか」「入力形式が正しいか」だけをzodで検証する。
// notesの行レベル認可（メンバーか、authorか）はDB側のRLSポリシーが担保するため、
// ここで重複したチェックは行わない。

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BOARD_HEIGHT, BOARD_WIDTH } from "@/app/rooms/board-constants";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/app/rooms/invite-code";
import { type Note, toNote } from "@/app/rooms/notes-reducer";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function failure<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

async function requireUser(supabase: SupabaseClient): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const JoinRoomInputSchema = z.object({
  code: z
    .string()
    .transform((value) => normalizeInviteCode(value))
    .refine((value) => isValidInviteCode(value), {
      message: "招待コードは英数字6桁で入力してください。",
    }),
});

const CreateNoteInputSchema = z.object({
  roomId: z.string().uuid(),
});

const UpdateNoteContentInputSchema = z.object({
  noteId: z.string().uuid(),
  content: z.string().max(2000, "本文は2000文字以内で入力してください。"),
});

const UpdateNotePositionInputSchema = z.object({
  noteId: z.string().uuid(),
  x: z.number().finite().min(0).max(BOARD_WIDTH),
  y: z.number().finite().min(0).max(BOARD_HEIGHT),
});

const DeleteNoteInputSchema = z.object({
  noteId: z.string().uuid(),
});

// ---------------------------------------------------------------
// ルーム作成/参加（<form action>から呼ばれ、成功時はredirectする）
// ---------------------------------------------------------------

export async function createRoom(): Promise<void> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("create_room");

  if (error || !data) {
    redirect(`/?error=${encodeURIComponent("ルームを作成できませんでした。")}`);
  }

  redirect(`/rooms/${data.id}`);
}

export async function joinRoom(formData: FormData): Promise<void> {
  const parsed = JoinRoomInputSchema.safeParse({
    code: String(formData.get("code") ?? ""),
  });

  if (!parsed.success) {
    redirect(
      `/?error=${encodeURIComponent("招待コードは英数字6桁で入力してください。")}`,
    );
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("join_room", {
    p_code: parsed.data.code,
  });

  if (error || !data) {
    redirect(`/?error=${encodeURIComponent("ルームが見つかりませんでした。")}`);
  }

  redirect(`/rooms/${data}`);
}

// ---------------------------------------------------------------
// 付箋のCRUD（ボードから直接呼ばれ、結果を返す）
// ---------------------------------------------------------------

export async function createNote(roomId: string): Promise<ActionResult<Note>> {
  const parsed = CreateNoteInputSchema.safeParse({ roomId });
  if (!parsed.success) {
    return failure("ルームIDが不正です。");
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) {
    return failure("ログインが必要です。");
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      room_id: parsed.data.roomId,
      author_id: user.id,
      // 新規付箋はボード中央付近に少しずつずらして配置する。
      x: 800 + Math.random() * 200,
      y: 500 + Math.random() * 200,
    })
    .select()
    .single();

  if (error || !data) {
    return failure("付箋を作成できませんでした。");
  }

  return success(toNote(data));
}

export async function updateNoteContent(
  noteId: string,
  content: string,
): Promise<ActionResult<null>> {
  const parsed = UpdateNoteContentInputSchema.safeParse({ noteId, content });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "入力内容が不正です。");
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) {
    return failure("ログインが必要です。");
  }

  // RLSで対象行が見えない場合、UPDATEはエラーにならず0行更新になる。
  // .select("id") で更新行を返させ、0件なら権限エラーとして扱う
  // （UI側の楽観更新のロールバックまでは行わない。既知の制限）。
  const { data, error } = await supabase
    .from("notes")
    .update({ content: parsed.data.content })
    .eq("id", parsed.data.noteId)
    .select("id");

  if (error) {
    return failure("付箋を更新できませんでした。");
  }

  if (!data || data.length === 0) {
    return failure("この操作を行う権限がありません。");
  }

  return success(null);
}

export async function updateNotePosition(
  noteId: string,
  x: number,
  y: number,
): Promise<ActionResult<null>> {
  const parsed = UpdateNotePositionInputSchema.safeParse({ noteId, x, y });
  if (!parsed.success) {
    return failure("付箋の位置が不正です。");
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) {
    return failure("ログインが必要です。");
  }

  // updateNoteContent と同様、0行更新（RLSによる不可視）を権限エラーとして扱う。
  const { data, error } = await supabase
    .from("notes")
    .update({ x: parsed.data.x, y: parsed.data.y })
    .eq("id", parsed.data.noteId)
    .select("id");

  if (error) {
    return failure("付箋の位置を更新できませんでした。");
  }

  if (!data || data.length === 0) {
    return failure("この操作を行う権限がありません。");
  }

  return success(null);
}

export async function deleteNote(noteId: string): Promise<ActionResult<null>> {
  const parsed = DeleteNoteInputSchema.safeParse({ noteId });
  if (!parsed.success) {
    return failure("付箋IDが不正です。");
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) {
    return failure("ログインが必要です。");
  }

  // DELETEポリシーは author 本人のみ許可。author でない場合は0行削除になるため、
  // .select("id") で削除行を返させ、0件なら権限エラーとして扱う。
  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", parsed.data.noteId)
    .select("id");

  if (error) {
    return failure("付箋を削除できませんでした。");
  }

  if (!data || data.length === 0) {
    return failure("この操作を行う権限がありません。");
  }

  return success(null);
}
