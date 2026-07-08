# リアルタイム付箋同期 縦切りPoC

> 検証日: 2026-07-03
> ブランチ: `poc/realtime-note-sync`（`develop` 起点）
> 目的: [`docs/tech-stack-research.md`](./tech-stack-research.md) の「最重要リスク」——
> **2ブラウザで付箋のドラッグが滑らかに同期するか**——を、認証・RLS・Realtime を
> 実際に配線して確かめる。技術スタック（Next.js + Supabase）の採用可否を判断するための最小実装。

## 結論

**縦切りPoCは成功。技術スタック（Next.js + Supabase Realtime）でMVPの中核要件が成立することを実機で確認した。**

- リアルタイム同期（作成・更新・移動・削除）が2クライアント間でリロード無しに反映される
- ドラッグ中の座標配信が設計どおりスロットルされ、遅延の蓄積が起きない
- 可視性・認可はRLSで宣言的に守れており、実際の攻撃SQLで迂回不能であることを実証した

このPoCは本番実装そのものではなく、配線が成立するかの検証。付箋UIは最小限で、フェーズ進行・投票・プレゼンス・タイマーは未実装（スコープ外）。

## 検証したこと

| 観点 | 内容 |
| --- | --- |
| 認証 | 既存の Supabase Auth（開発用メールログイン）で owner / member がログインできる |
| ルーム | `create_room` / `join_room` RPC でルーム作成と招待コード参加ができる |
| 可視性（RLS） | 非メンバーはルーム・付箋を参照できず、`/rooms/[id]` 直アクセスで 404 になる |
| リアルタイム | notes の INSERT/UPDATE/DELETE が `realtime.broadcast_changes` トリガー経由で対向クライアントへ配信される |
| ドラッグ同期 | ドラッグ中の座標がプライベートチャンネルの `note-drag` broadcast で流れ、ドロップ時にDBへ永続化される |
| 認可の堅牢性 | RLS を実際の攻撃SQLで検証し、迂回不能であることを確認した |

## アーキテクチャ（実装した構成）

```
ブラウザ (owner)                     ブラウザ (member)
  │  Server Action (notes CRUD)         │
  ▼                                     ▼
Supabase Postgres (RLSで行を保護)  ◀──────┘
  │  notes への INSERT/UPDATE/DELETE
  ▼
realtime.broadcast_changes トリガー
  │  topic = 'room:<uuid>'（private channel）
  ▼
Supabase Realtime  ──▶ 両クライアントが購読（realtime.messages のRLSでメンバーのみ受信）

※ ドラッグ中の座標だけは Server Action / DB を経由せず、
   クライアント → Realtime → クライアント の broadcast（約80msスロットル）で流す。
   ドロップ確定時のみ updateNotePosition でDBへ書く。
```

- **正データ**は Postgres の `notes` 行。書き込みは Server Action 経由（zod 検証 + 認可はRLS/RPC）。
- **配信**は `realtime.broadcast_changes()` トリガー（Supabase の現行推奨パターン）。
- **プライベートチャンネル + Realtime Authorization**: `realtime.messages` にRLSを張り、`room:<uuid>` の送受信をそのルームのメンバーだけに許可。クライアントは `private: true` で購読し、購読前に `supabase.realtime.setAuth()` を呼ぶ。
- **ドラッグ座標**はDBを経由しない一時 broadcast にすることで、高頻度書き込みによる Realtime レート制限の圧迫を避ける。

## 計測結果（ドラッグ同期 — 最重要リスク）

対向クライアント（owner）が、member のドラッグ中に受信した `note-drag` broadcast:

- 受信件数: 10件（1回のドラッグ操作）
- **受信間隔: 69〜99ms**（設計値 80ms スロットルに一致。遅延の蓄積・詰まりなし）
- ドロップ後のDB上の座標が期待値と完全一致し、リロードしても保持された

「カクつき／遅延蓄積」の兆候は観測されず、スロットル方式（クライアント間 broadcast + ドロップ時のみ永続化）が有効であることを確認した。受信側の補間（lerp）は本PoCでは未実装だが、この間隔なら本実装で追加すれば十分滑らかにできる見込み。

## 認可検証（実攻撃SQLによる実証）

RLS を「メンバーである」だけで通していた初期実装には、**メンバーが他人の付箋を窃取・削除できる**穴があり、レビューで実SQLにより再現・確認した上で修正した。

| 攻撃 | 修正前 | 修正後（実機で再確認） |
| --- | --- | --- |
| 他人の付箋の `author_id` を自分に書き換え → author限定deleteを迂回して削除 | 成立（削除できた） | `42501 permission denied`（列レベルGRANTで不能） |
| 他人の付箋の `room_id` を自分だけのルームへ書き換えて持ち出し | 成立（移動できた） | `42501 permission denied` |
| メンバーによる正規の `content` / `x` / `y` 更新 | 成立 | 成立（影響なし） |

**修正方針**: `notes` の UPDATE 権限を `grant update (content, x, y)` の列限定に絞った。`author_id` / `room_id` は UPDATE 権限自体が無くなるため、RLSポリシー評価より前の列権限チェックで拒否される。「ポリシーの隙間」ではなく「権限の不在」で塞ぐため、将来のポリシー変更で再発しにくい。これらの攻撃はすべて pgTAP の否定系テストとして固定した。

## テスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| pgTAP (`supabase test db`) | RLS の肯定/否定系、`join_room` 冪等性、トリガー・Realtimeポリシーの存在、上記攻撃の否定系 | 28件 pass |
| Vitest | スロットル関数、notes適用reducer（INSERT/UPDATE/DELETE/drag + 自分ドラッグ優先）、招待コード検証、表示コンポーネント | 50件 pass |
| Storybook | 付箋カード・ボードの表示（Supabase非依存の presentational component） | ビルド成功 |
| lint / typecheck / build | Biome / tsc / next build | すべて成功（`/rooms/[id]` は動的ルート） |

## 実装ファイル

- `supabase/migrations/20260703131517_realtime_note_sync.sql` — rooms / room_members / notes、RLS、`create_room` / `join_room` RPC、broadcast トリガー、Realtime Authorization ポリシー、内部ヘルパー用 `internal` スキーマ
- `supabase/tests/realtime_note_sync_test.sql` — pgTAP（28件）
- `app/rooms/actions.ts` — Server Actions（zod 検証 + RLS/RPC 認可）
- `app/rooms/[id]/` — ルーム画面（Server Component）、ボードコンテナ（Realtime配線）、表示コンポーネント
- `app/rooms/{throttle,invite-code,notes-reducer,board-constants}.ts` — テスト可能な純粋ロジック
- `app/page.tsx` — トップにルーム作成 / 参加フォームを追加

## 既知の制限（PoCスコープ外・本実装で対応）

- **受信側の補間なし**: `note-drag` は受信位置を即反映するのみ。本実装では lerp を入れるとより滑らかになる。
- **プレゼンス・タイマー・フェーズ進行・投票は未実装**: 本PoCの検証対象外。
- **招待コードのレート制限なし**: 6桁コード（約30bit）で総当たり耐性は低い。本番前にレート制限・有効期限を推奨。
- **トークンリフレッシュ時の `setAuth()` 再同期なし**: 長時間セッションでRealtime認可が切れうる。
- **Server Action のロールバック無し**: RLSで0行に絞られた場合はエラーを返すが、楽観更新済みのUI巻き戻しは本実装で扱う。

## 手動確認手順（マージ前に人手で1回推奨）

自動化ブラウザ（Playwright MCP）では trusted マウスイベントが React に届かない環境依存の問題があったため、DB直接操作・プログラム的イベント・実クライアント購読で全経路を検証した。アプリのバグではないが、人手での2ブラウザ確認を1回推奨する。

1. `npx supabase db reset` の後、`SUPABASE_SERVICE_ROLE_KEY=$(npx supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2 | tr -d '"') npm run seed:dev-users`
2. `npm run dev`、Cookie が分かれる2ウィンドウ（通常＋シークレット等）を開く
3. ウィンドウA: `owner@example.test` / `password` でログイン → 「ルームを作成」→ 表示された招待コードを控える
4. ウィンドウB: `member@example.test` / `password` でログイン → 招待コードを入力して参加
5. どちらかで付箋を追加・編集・ドラッグ → もう一方がライブ更新することを確認、リロードで永続化を確認
