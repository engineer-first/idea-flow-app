begin;

select plan(29);

select has_table('public', 'rooms', 'rooms table exists');
select has_table('public', 'room_members', 'room_members table exists');
select has_column('public', 'rooms', 'invite_code', 'rooms has invite_code');
select has_column('public', 'rooms', 'invite_expires_at', 'rooms has invite_expires_at');
select has_column('public', 'room_members', 'role', 'room_members has role');
select col_is_pk('public', 'rooms', 'id', 'rooms.id is primary key');
select col_is_pk('public', 'room_members', array['room_id', 'user_id'], 'room_members has composite primary key');
select col_has_default('public', 'rooms', 'invite_expires_at', 'invite_expires_at has default');
select isnt_empty(
  $$
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'room_members'
      and indexdef like '%user_id%'
  $$,
  'room_members.user_id is indexed'
);
select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rooms'
  $$,
  'rooms has RLS policies'
);
select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_members'
  $$,
  'room_members has RLS policies'
);
select has_function('public', 'create_room', array[]::name[], 'create_room function exists');
select has_function('public', 'join_room_by_invite_code', array['text']::name[], 'join_room_by_invite_code function exists');
select ok(
  has_table_privilege('authenticated', 'public.rooms', 'SELECT'),
  'authenticated can select rooms'
);
select ok(
  not has_table_privilege('authenticated', 'public.rooms', 'INSERT'),
  'authenticated cannot directly insert rooms'
);
select ok(
  not has_table_privilege('anon', 'public.rooms', 'SELECT'),
  'anon cannot select rooms'
);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'owner@example.test',
    'test',
    now(),
    'authenticated',
    'authenticated'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'member@example.test',
    'test',
    now(),
    'authenticated',
    'authenticated'
  )
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temporary table created_room as
select * from public.create_room();

select is((select count(*)::integer from created_room), 1, 'create_room returns one row');
select isnt((select invite_code from created_room), null, 'create_room returns invite code');
select ok(
  (select invite_expires_at > now() + interval '23 hours 59 minutes' from created_room),
  'invite_expires_at is close to 24 hours in the future'
);
select is(
  (
    select count(*)::integer
    from public.rooms r
    join public.room_members rm on rm.room_id = r.id
    where r.invite_code = (select invite_code from created_room)
      and rm.user_id = '11111111-1111-1111-1111-111111111111'::uuid
      and rm.role = 'host'
  ),
  1,
  'create_room creates host membership atomically'
);

set local "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (
    select count(*)::integer
    from public.rooms
    where invite_code = (select invite_code from created_room)
  ),
  0,
  'non-member cannot select room before joining'
);

select lives_ok(
  format(
    'select * from public.join_room_by_invite_code(%L)',
    (select invite_code from created_room)
  ),
  'participant can join with a valid invite code'
);
select is(
  (
    select role
    from public.room_members
    where user_id = '22222222-2222-2222-2222-222222222222'::uuid
      and room_id = (
        select id from public.rooms where invite_code = (select invite_code from created_room)
      )
  ),
  'participant',
  'joining creates participant membership'
);
select lives_ok(
  format(
    'select * from public.join_room_by_invite_code(%L)',
    (select invite_code from created_room)
  ),
  'joining is idempotent for existing participants'
);

set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  format(
    'select * from public.join_room_by_invite_code(%L)',
    (select invite_code from created_room)
  ),
  'host can re-open invite without being demoted'
);
select is(
  (
    select role
    from public.room_members
    where user_id = '11111111-1111-1111-1111-111111111111'::uuid
      and room_id = (
        select id from public.rooms where invite_code = (select invite_code from created_room)
      )
  ),
  'host',
  'host role is preserved'
);

reset role;

update public.rooms
set invite_expires_at = now() - interval '1 second'
where invite_code = (select invite_code from created_room);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  format(
    'select * from public.join_room_by_invite_code(%L)',
    (select invite_code from created_room)
  ),
  'IF002',
  'Invite code has expired',
  'expired invite code is rejected with IF002'
);
select throws_ok(
  $$select * from public.join_room_by_invite_code('missing-code')$$,
  'IF001',
  'Invite code was not found',
  'missing invite code is rejected with IF001'
);

set local "request.jwt.claims" = '{"role":"authenticated"}';
select throws_ok(
  $$select * from public.create_room()$$,
  'IF003',
  'Authentication is required',
  'unauthenticated create_room is rejected with IF003'
);

select * from finish();

rollback;
