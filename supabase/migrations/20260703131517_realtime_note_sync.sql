-- リアルタイム付箋同期の縦切りPoC。
-- rooms / room_members / notes の3テーブルと、それを守るRLS、
-- メンバー登録用のRPC、notesの変更をRealtime Broadcastへ流すトリガーを
-- 1本のマイグレーションにまとめる（意図として最小単位で戻せる範囲）。

-- =============================================================
-- 0. internal スキーマ
-- =============================================================
-- RLSポリシーやトリガーの内部でのみ使うヘルパー関数を置く場所。
-- supabase/config.toml の api.schemas には含まれないため、
-- PostgREST 経由（/rest/v1/rpc/...）では絶対に呼び出せない。
-- security definer 関数は「authenticatedロールが直接叩ける公開APIになる」
-- ことが最大のリスクなので、公開APIとして意図していない関数は
-- 最初からこのスキーマに置いて到達不能にする。
create schema internal;

comment on schema internal is 'RLS/トリガー内部専用のヘルパー関数を置くスキーマ。Data APIには公開しない。';

grant usage on schema internal to authenticated;

-- =============================================================
-- 1. テーブル
-- =============================================================

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.rooms is 'リアルタイム付箋ボードのルーム。招待コードで参加する。';

create index rooms_host_id_idx on public.rooms (host_id);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

comment on table public.room_members is 'ルームの参加者。直接INSERTは許可せず、create_room/join_room RPC経由でのみ追加する。';

-- 複合PK(room_id, user_id)はroom_id単独の検索はカバーするが、
-- user_id単独（auth.users削除時のON DELETE CASCADEなど）はカバーしないため個別に用意する。
create index room_members_user_id_idx on public.room_members (user_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  content text not null default '',
  x double precision not null default 0,
  y double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notes is 'ルームに紐づく付箋。位置(x, y)はボード座標系。';

create index notes_room_id_idx on public.notes (room_id);
create index notes_author_id_idx on public.notes (author_id);

-- updated_at を自動更新するための共通トリガー関数。
-- search_path を空にし、参照するオブジェクトが無い（pg_catalogの組み込み関数のみ）ため
-- search_path 汚染の影響を受けない。
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

-- =============================================================
-- 2. RLSヘルパー（再帰RLSを避けるための security definer 関数）
-- =============================================================

-- room_members への SELECT ポリシーが room_members 自身を参照すると
-- 再帰的にRLSが評価されてしまうため、security definer 関数でRLSをバイパスして
-- 「呼び出しユーザーが指定ルームのメンバーか」だけを判定する。
-- 関数内で明示的に auth.uid() を使っており、任意ロールから呼ばれても
-- 呼び出し元自身の membership しか確認できない（他人の情報は漏れない）。
-- search_path は空にし、すべての参照をスキーマ修飾することで
-- search_path 経由のなりすまし（同名オブジェクトの差し替え）を防ぐ。
create or replace function internal.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.room_members m
    where m.room_id = p_room_id
      and m.user_id = auth.uid()
  );
$$;

-- RLSポリシーの評価はクエリを発行したロール（authenticated）自身の権限で行われるため、
-- authenticatedにEXECUTEを許可する必要がある。internalスキーマがData APIに
-- 公開されていないため、これはRPCエンドポイントの公開を意味しない。
revoke execute on function internal.is_room_member(uuid) from public;
grant execute on function internal.is_room_member(uuid) to authenticated;

-- =============================================================
-- 3. RLS ポリシー
-- =============================================================

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.notes enable row level security;

-- rooms: メンバーのみ参照でき、host本人のみ作成できる。
create policy "rooms_select_members" on public.rooms
for select
to authenticated
using (internal.is_room_member(id));

create policy "rooms_insert_host" on public.rooms
for insert
to authenticated
with check (host_id = (select auth.uid()));

-- room_members: 同じルームのメンバーのみ参照できる。INSERTは許可しない
-- （create_room / join_room RPC が security definer で行う）。
create policy "room_members_select_same_room" on public.room_members
for select
to authenticated
using (internal.is_room_member(room_id));

-- notes: ルームメンバーはSELECT/INSERT/UPDATEでき、DELETEは author のみ。
create policy "notes_select_members" on public.notes
for select
to authenticated
using (internal.is_room_member(room_id));

create policy "notes_insert_members" on public.notes
for insert
to authenticated
with check (
  internal.is_room_member(room_id)
  and author_id = (select auth.uid())
);

create policy "notes_update_members" on public.notes
for update
to authenticated
using (internal.is_room_member(room_id))
with check (internal.is_room_member(room_id));

create policy "notes_delete_author" on public.notes
for delete
to authenticated
using (author_id = (select auth.uid()));

-- =============================================================
-- 3.5 Data APIへのテーブル露出（権限）
-- =============================================================
-- ローカル設定 (auto_expose_new_tables 相当) では新規テーブルはData APIロールへ
-- 自動的に公開されないため、明示的にGRANTする。行の可視性はRLSが担うので、
-- ここでのGRANTは「テーブルに到達できるか」のみを制御する
-- （Realtime Authorizationのドキュメント例に倣い、SELECTはanonにも許可し、
-- RLSが `to authenticated` のみを許可することで実質的にanonからは0件になる）。
grant select on public.rooms to anon, authenticated;
grant insert on public.rooms to authenticated;

grant select on public.room_members to anon, authenticated;
-- room_members へのINSERTはRPC（security definer）経由のみとし、
-- authenticatedロールへの直接INSERT権限は付与しない。

grant select on public.notes to anon, authenticated;
grant insert, delete on public.notes to authenticated;
-- UPDATEは列限定にする。全列を許可すると、RLSは「ルームメンバーであること」
-- しか見ていないため、メンバーが他人の付箋の author_id を自分に書き換えて
-- author限定DELETEを迂回したり、room_id を自分だけのルームへ書き換えて
-- 付箋を窃取する攻撃が成立してしまう。共同編集の対象は本文と位置のみ。
grant update (content, x, y) on public.notes to authenticated;

-- =============================================================
-- 4. RPC
-- =============================================================

-- 招待コードを生成する。誤読しやすい 0/O, 1/I を除いた32文字から6文字を選ぶ。
-- create_room() の内部からのみ呼ばれるヘルパーなので internal スキーマに置き、
-- authenticated への EXECUTE 権限は付与しない（呼び出し元がsecurity definerの
-- オーナー権限で実行するため不要）。
create or replace function internal.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1),
    ''
  )
  from generate_series(1, 6);
$$;

-- Postgresは新規関数にデフォルトでPUBLICへのEXECUTEを付与するため明示的に剥奪する。
revoke execute on function internal.generate_invite_code() from public;

-- ルームを作成し、hostをroom_membersへ登録する。招待コードの一意制約に
-- 衝突した場合は再生成してリトライする（衝突確率は低いが起こり得るため）。
-- これは意図的に公開RPC（/rest/v1/rpc/create_room）として authenticated に
-- 実行を許可している（advisorのWARNは想定内）。関数冒頭で auth.uid() の
-- nullチェックを行い、未認証での実行は必ず失敗させる。
create or replace function public.create_room()
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  loop
    v_attempts := v_attempts + 1;
    begin
      insert into public.rooms (invite_code, host_id)
      values (internal.generate_invite_code(), auth.uid())
      returning * into v_room;
      exit;
    exception when unique_violation then
      if v_attempts >= 10 then
        raise exception 'ルームの作成に失敗しました。もう一度お試しください。';
      end if;
    end;
  end loop;

  insert into public.room_members (room_id, user_id)
  values (v_room.id, auth.uid())
  on conflict (room_id, user_id) do nothing;

  return v_room;
end;
$$;

revoke execute on function public.create_room() from public;
grant execute on function public.create_room() to authenticated;

-- 招待コードからルームを特定し、呼び出しユーザーをroom_membersへ追加する。
-- コードで検索する時点ではまだメンバーではない（rooms のSELECT RLSを通らない）ため、
-- security definer のRPCが必須になる。既にメンバーであれば何もしない（冪等）。
-- create_room()と同様、意図的に公開RPCとして authenticated に実行を許可している。
create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select id into v_room_id
  from public.rooms
  where invite_code = upper(p_code);

  if v_room_id is null then
    raise exception '招待コードが見つかりません。';
  end if;

  insert into public.room_members (room_id, user_id)
  values (v_room_id, auth.uid())
  on conflict (room_id, user_id) do nothing;

  return v_room_id;
end;
$$;

revoke execute on function public.join_room(text) from public;
grant execute on function public.join_room(text) to authenticated;

-- =============================================================
-- 5. Realtime Broadcast: notes の変更をルームチャンネルへ配信する
-- =============================================================

-- topic 'room:<uuid>' から room_id を安全に取り出す。形式が合わない場合は
-- 例外を投げず null を返す（realtime.messages のRLS評価中に例外で落ちないため）。
-- realtime.messages のRLSポリシーからauthenticatedとして呼ばれるヘルパーなので
-- internalスキーマに置く（Data APIには公開しない）。
create or replace function internal.parse_room_topic(p_topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  -- 正規のUUID形式（8-4-4-4-12）に厳密にマッチさせる。
  -- '[0-9a-fA-F-]{36}' のような緩い形式だとハイフン36個等にもマッチし、
  -- ::uuid キャストが例外を投げて「例外を投げず null を返す」契約に違反する
  -- （realtime.messages のRLS評価そのものを失敗させてしまう）。
  select case
    when p_topic ~ '^room:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then substring(p_topic from 6)::uuid
    else null
  end;
$$;

revoke execute on function internal.parse_room_topic(text) from public;
grant execute on function internal.parse_room_topic(text) to authenticated;

create or replace function internal.notes_broadcast_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'room:' || coalesce(new.room_id, old.room_id)::text, -- topic
    tg_op,                                                -- event
    tg_op,                                                -- operation
    tg_table_name,                                        -- table
    tg_table_schema,                                      -- schema
    new,                                                  -- new record
    old                                                   -- old record
  );
  return null;
end;
$$;

revoke execute on function internal.notes_broadcast_changes() from public;

create trigger notes_broadcast_changes_trigger
after insert or update or delete on public.notes
for each row
execute function internal.notes_broadcast_changes();

-- Realtime Authorization: realtime.messages に対するRLS。
-- private channel 'room:<uuid>' の受信(SELECT)・送信(INSERT)を、
-- そのルームのメンバーのみに許可する。realtime.messages は
-- Supabase側のマイグレーションで既にRLSが有効化されているため、
-- ここではポリシーの追加のみ行う。
create policy "room_members_can_receive_broadcast" on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.room_members m
    where m.room_id = internal.parse_room_topic(realtime.topic())
      and m.user_id = (select auth.uid())
  )
);

create policy "room_members_can_send_broadcast" on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.room_members m
    where m.room_id = internal.parse_room_topic(realtime.topic())
      and m.user_id = (select auth.uid())
  )
);
