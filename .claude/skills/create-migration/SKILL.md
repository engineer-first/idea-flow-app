---
name: create-migration
description: Supabase migration と pgTAP テストをペアで作成し、supabase test db で検証する
argument-hint: <migration-name>
disable-model-invocation: true
---

# Supabase migration 作成

`$ARGUMENTS` で指定された名前の migration を、pgTAP テストとペアで作成する。migration 単体で完結させず、必ず「migration + テスト + 検証」を 1 セットで行う。

## 手順

1. `supabase migration new <name>` で migration ファイルを生成する。ファイル名を手で作ったり、タイムスタンプを推測したりしない
2. 生成された `supabase/migrations/<timestamp>_<name>.sql` に SQL を書く
   - スコープは最小限に保ち、意図として戻せる形にする
   - 新規テーブルは `alter table ... enable row level security;` を必ず含め、policy を定義する
   - 特権的なデータベースワークフローは RPC（`security definer` 関数）にまとめる
3. RLS / trigger / RPC を含む場合は `supabase test new <name>` で pgTAP テストを生成し、`supabase/tests/` 配下に必ず追加する
4. `supabase test db` で green を確認する（ローカル Supabase が起動していること）

## pgTAP テンプレート

```sql
begin;
select plan(3);

select has_table('public', 'ideas', 'ideas テーブルが存在する');

-- RLS が有効であること
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ideas'::regclass),
  'ideas テーブルで RLS が有効'
);

-- 認可の検証は anon / authenticated / 他ユーザーの 3 視点で行う
set local role anon;
select is_empty(
  $$ select * from public.ideas $$,
  'anon はデータを参照できない'
);

select * from finish();
rollback;
```

## ガードレール

- クライアントコードを楽にするために RLS policy を緩めない
- policy の検証は最低でも anon / authenticated（本人）/ authenticated（他ユーザー）の 3 視点で行う
- migration とテストは同じ PR に含める
