create extension if not exists pgcrypto with schema extensions;

create table public.rooms (
  id bigint generated always as identity primary key,
  invite_code text not null unique,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  invite_expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_id bigint not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_members_role_check check (role in ('host', 'participant'))
);

create index room_members_user_id_idx on public.room_members (user_id);
create index room_members_room_id_idx on public.room_members (room_id);
create index rooms_host_user_id_idx on public.rooms (host_user_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

revoke all on table public.rooms from anon;
revoke all on table public.room_members from anon;
revoke all on table public.rooms from authenticated;
revoke all on table public.room_members from authenticated;
grant select on table public.rooms to authenticated;
grant select on table public.room_members to authenticated;

create policy "Members can view their rooms."
on public.rooms
for select
to authenticated
using (
  exists (
    select 1
    from public.room_members
    where room_members.room_id = rooms.id
      and room_members.user_id = (select auth.uid())
  )
);

create policy "Members can view their own room memberships."
on public.room_members
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.make_invite_code()
returns text
language sql
security definer
set search_path = ''
as $$
  select rtrim(
    translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
    '='
  );
$$;

revoke execute on function public.make_invite_code() from public;

create or replace function public.create_room()
returns table(invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id bigint;
  v_invite_code text;
  v_invite_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = 'IF003';
  end if;

  loop
    v_invite_code := public.make_invite_code();

    begin
      insert into public.rooms (invite_code, host_user_id)
      values (v_invite_code, v_user_id)
      returning id, public.rooms.invite_expires_at
      into v_room_id, v_invite_expires_at;

      exit;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  insert into public.room_members (room_id, user_id, role)
  values (v_room_id, v_user_id, 'host');

  return query select v_invite_code, v_invite_expires_at;
end;
$$;

revoke execute on function public.create_room() from public;
grant execute on function public.create_room() to authenticated;

create or replace function public.join_room_by_invite_code(p_invite_code text)
returns table(invite_code text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id bigint;
  v_invite_expires_at timestamptz;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = 'IF003';
  end if;

  select rooms.id, rooms.invite_expires_at
  into v_room_id, v_invite_expires_at
  from public.rooms
  where rooms.invite_code = p_invite_code;

  if v_room_id is null then
    raise exception 'Invite code was not found' using errcode = 'IF001';
  end if;

  if v_invite_expires_at <= now() then
    raise exception 'Invite code has expired' using errcode = 'IF002';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (v_room_id, v_user_id, 'participant')
  on conflict (room_id, user_id) do nothing;

  select room_members.role
  into v_role
  from public.room_members
  where room_members.room_id = v_room_id
    and room_members.user_id = v_user_id;

  return query select p_invite_code, v_role;
end;
$$;

revoke execute on function public.join_room_by_invite_code(text) from public;
grant execute on function public.join_room_by_invite_code(text) to authenticated;
