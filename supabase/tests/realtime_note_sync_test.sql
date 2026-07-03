-- リアルタイム付箋同期PoCのpgTAPテスト。
-- 3視点（anon / メンバーではないauthenticated / メンバー本人）でRLSを検証し、
-- join_roomの冪等性、notesのbroadcastトリガー、realtime.messagesの
-- Authorizationポリシーの存在も確認する。

BEGIN;
SELECT plan(28);

-- ---------------------------------------------------------------
-- スキーマの存在確認
-- ---------------------------------------------------------------

SELECT has_table('public', 'rooms', 'rooms テーブルが存在する');
SELECT has_table('public', 'room_members', 'room_members テーブルが存在する');
SELECT has_table('public', 'notes', 'notes テーブルが存在する');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rooms'::regclass),
  'rooms で RLS が有効'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.room_members'::regclass),
  'room_members で RLS が有効'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notes'::regclass),
  'notes で RLS が有効'
);

SELECT has_trigger(
  'public', 'notes', 'notes_broadcast_changes_trigger',
  'notes に broadcast_changes トリガーが存在する'
);

SELECT policy_cmd_is(
  'realtime', 'messages', 'room_members_can_receive_broadcast', 'SELECT',
  'realtime.messages に受信(SELECT)ポリシーが存在する'
);
SELECT policy_cmd_is(
  'realtime', 'messages', 'room_members_can_send_broadcast', 'INSERT',
  'realtime.messages に送信(INSERT)ポリシーが存在する'
);

-- ---------------------------------------------------------------
-- テストユーザーとルームの準備
-- ---------------------------------------------------------------

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'host@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'outsider@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'joiner@example.test');

-- host として create_room() を呼び、ルームと自身のmembershipを作成する。
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

SELECT id, invite_code INTO TEMP host_room FROM public.create_room();

SELECT is(
  (SELECT count(*)::int FROM public.room_members WHERE room_id = (SELECT id FROM host_room)),
  1,
  'create_room() は host を room_members に1件だけ登録する'
);

INSERT INTO public.notes (room_id, author_id, content)
VALUES ((SELECT id FROM host_room), '11111111-1111-1111-1111-111111111111', 'host note');

-- ---------------------------------------------------------------
-- 非メンバー(outsider)の視点
-- ---------------------------------------------------------------

RESET role;
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" TO '22222222-2222-2222-2222-222222222222';

SELECT is_empty(
  $$ SELECT * FROM public.rooms $$,
  '非メンバーは rooms を SELECT できない'
);
SELECT is_empty(
  $$ SELECT * FROM public.notes $$,
  '非メンバーは notes を SELECT できない'
);

PREPARE outsider_insert_note AS
  INSERT INTO public.notes (room_id, author_id, content)
  VALUES (
    (SELECT id FROM host_room),
    '22222222-2222-2222-2222-222222222222',
    'intrusion'
  );

SELECT throws_ok(
  'EXECUTE outsider_insert_note',
  'new row violates row-level security policy for table "notes"',
  '非メンバーは notes に INSERT できない'
);

-- UPDATEはSELECTポリシーで行が見えない場合、エラーにならず0行更新になる。
-- RETURNINGで更新行が空であることを直接検証する。
SELECT is_empty(
  $$ UPDATE public.notes SET content = 'hacked by outsider' RETURNING id $$,
  '非メンバーの UPDATE は 0 行（サイレントに何も起きない）'
);

-- ---------------------------------------------------------------
-- メンバー(host)の視点
-- ---------------------------------------------------------------

RESET role;
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

SELECT is(
  (SELECT count(*)::int FROM public.rooms WHERE id = (SELECT id FROM host_room)),
  1,
  'メンバー(host)は自分のルームを SELECT できる'
);
SELECT is(
  (SELECT count(*)::int FROM public.notes WHERE room_id = (SELECT id FROM host_room)),
  1,
  'メンバー(host)は notes を SELECT できる'
);

-- 直前の非メンバーによるUPDATE攻撃で本文が変わっていないことを確認する。
SELECT is(
  (SELECT content FROM public.notes WHERE room_id = (SELECT id FROM host_room)),
  'host note',
  '非メンバーの UPDATE 後も本文は変わっていない'
);

-- join_room の冪等性: 既にメンバーの host が自分のルームに再度参加しても
-- room_members は増えない。
SELECT public.join_room((SELECT invite_code FROM host_room));
SELECT public.join_room((SELECT invite_code FROM host_room));

SELECT is(
  (SELECT count(*)::int FROM public.room_members WHERE room_id = (SELECT id FROM host_room)),
  1,
  'join_room() を複数回呼んでも room_members は重複しない（冪等）'
);

-- ---------------------------------------------------------------
-- join_room で新規参加する視点(joiner)
-- ---------------------------------------------------------------

RESET role;
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" TO '33333333-3333-3333-3333-333333333333';

SELECT is_empty(
  $$ SELECT * FROM public.rooms $$,
  'join_room 前の joiner は rooms を SELECT できない'
);

SELECT public.join_room((SELECT invite_code FROM host_room));

SELECT is(
  (SELECT count(*)::int FROM public.rooms WHERE id = (SELECT id FROM host_room)),
  1,
  'join_room 後の joiner は該当ルームを SELECT できる'
);

-- ---------------------------------------------------------------
-- メンバーによる権限昇格攻撃の防止（列限定GRANTの検証）
-- ---------------------------------------------------------------
-- UPDATEのGRANTを content / x / y に限定しているため、メンバーであっても
-- author_id / room_id の書き換えは列権限エラー(42501)で拒否される。
-- これを許すと「author_idを自分に書き換えてauthor限定DELETEを迂回する」
-- 「room_idを自分だけのルームへ書き換えて付箋を窃取する」攻撃が成立する。

PREPARE member_update_author AS
  UPDATE public.notes
  SET author_id = '33333333-3333-3333-3333-333333333333'
  WHERE room_id = (SELECT id FROM host_room);

SELECT throws_ok(
  'EXECUTE member_update_author',
  '42501',
  NULL,
  'メンバーは他人の付箋の author_id を変更できない（permission denied）'
);

PREPARE member_update_room AS
  UPDATE public.notes
  SET room_id = '99999999-9999-9999-9999-999999999999'
  WHERE room_id = (SELECT id FROM host_room);

SELECT throws_ok(
  'EXECUTE member_update_room',
  '42501',
  NULL,
  'メンバーは他人の付箋の room_id を変更できない（permission denied）'
);

-- DELETEポリシーは author 本人のみ許可しているため、
-- author でないメンバーの DELETE はエラーにならず0行になる。
SELECT is_empty(
  $$ DELETE FROM public.notes
     WHERE room_id = (SELECT id FROM host_room)
     RETURNING id $$,
  'author でないメンバーの DELETE は 0 行'
);

RESET role;

-- parse_room_topic は不正形式のトピックで例外を投げず null を返すこと。
-- realtime.messages のRLS評価中に呼ばれるため、例外を投げると
-- 正当な購読の認可判定そのものが失敗してしまう。
SELECT is(
  internal.parse_room_topic('room:' || repeat('-', 36)),
  NULL::uuid,
  'parse_room_topic は不正形式（ハイフン36個）で例外を投げず null を返す'
);
SELECT is(
  (SELECT count(*)::int FROM public.room_members WHERE room_id = (SELECT id FROM host_room)),
  2,
  'join_room 後、room_members に joiner が追加されている'
);

-- ---------------------------------------------------------------
-- anon の視点
-- ---------------------------------------------------------------

SET LOCAL role anon;

SELECT is_empty(
  $$ SELECT * FROM public.rooms $$,
  'anon は rooms を SELECT できない'
);
SELECT is_empty(
  $$ SELECT * FROM public.notes $$,
  'anon は notes を SELECT できない'
);
SELECT is_empty(
  $$ SELECT * FROM public.room_members $$,
  'anon は room_members を SELECT できない'
);

RESET role;
SELECT * FROM finish();
ROLLBACK;
