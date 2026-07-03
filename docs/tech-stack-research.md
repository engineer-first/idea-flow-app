# MVP 技術スタック調査

> 調査日: 2026-07-03
> 対象スコープ: [`docs/prd.md`](./prd.md) の MVP（①ルーム 〜 ⑤アイデア決定。AI ファシリテーション・LLM 連携・ペルソナ作成・成果物出力は Non-Goal）
> 論点: 現行の **Next.js + Supabase（+ Vercel）** 構成は本当にベストか。**Next.js + Cloudflare** 系構成と比較して評価する。

## 結論

**Next.js + Supabase（+ Vercel）の現行路線を継続することを推奨する。**

Cloudflare（Workers + Durable Objects）は「ルーム単位のリアルタイムアプリ」に対してアーキテクチャ的には非常に美しい選択肢だが、このチーム・このMVPにおいては、認証の再構築・テスト戦略の再構築・学習コストという乗り換え費用が、得られるメリット（同期のサーバー権威性・エッジレイテンシ）を上回る。MVPの同期要件は「行単位の付箋の共有＋最後勝ち」で足りるため、Supabase Realtime で十分に成立する。

あわせて、ホワイトボードは tldraw を使わず**構造化ボードとして自作**し、付箋・投票を Postgres の行として持つことを推奨する（理由は後述）。

---

## 1. MVP の技術要件

PRD の MVP スコープから導かれる要件は次の4つに集約される。AI・出力系が Non-Goal になったことで、要件は純粋な「リアルタイム共同作業＋可視性制御」に絞られた。

| # | 要件 | 内容 |
| --- | --- | --- |
| R1 | ルーム／フェーズ状態機械 | ①〜⑤のフェーズ・ステップを全員が同期して進む。遷移操作はホストのみ。再接続時に現在状態へ復帰できる。 |
| R2 | 付箋のリアルタイム同期 | 付箋の作成・編集・移動（グルーピング・2軸マップ）が全員の画面へ反映される。競合は「最後勝ち」で許容。 |
| R3 | 可視性制御 | 個人ワーク中は自分の付箋のみ見える。ステルス投票中は自分の票のみ見える。開票後に集計を公開する。**クライアントの出し分けではなくサーバー側で強制する**（DevTools で他人の票が見えてはならない）。 |
| R4 | プレゼンス・タイマー | 誰が在室中かの表示。タイマーはサーバー時刻基準（`ends_at`）で全員同期。 |

---

## 2. 候補構成

### 構成A: Next.js + Supabase + Vercel（現行路線）

- ホスティング: Vercel（Next.js App Router）
- データ: Supabase Postgres（付箋・投票・ルームを行として保持）
- 認可: RLS（Row Level Security）+ Server Action / RPC
- リアルタイム: Supabase Realtime
  - 正データの配信: `realtime.broadcast_changes()` トリガー（テーブル更新 → `room:{id}` チャンネルへ差分配信。Supabase の現行推奨パターン）
  - ドラッグ中の座標: スロットル付き Broadcast（DB を経由しない一時データ）
  - 在室表示: Presence
  - チャンネル認可: Realtime Authorization（RLS ベースのプライベートチャンネル）
- 認証: Supabase Auth（Google OAuth。**リポジトリに導入・検証済み**）

### 構成B: Next.js + Cloudflare フルスタック

- ホスティング: Cloudflare Workers（`@opennextjs/cloudflare` アダプタで Next.js をデプロイ）
- ルーム: **Durable Object**（1ルーム = 1オブジェクト）。単一スレッドの権威サーバーとして状態機械・付箋・投票を保持し、WebSocket Hibernation API で全クライアントと直結
- 永続化: Durable Object 内蔵の SQLite ストレージ（Free プランでも利用可）
- 認証: 自前構築が必要（Better Auth / Auth.js 等 + D1/KV）。Cloudflare Access は社内向けゼロトラスト製品であり、コンシューマ向けログインには使えない
- テスト: `@cloudflare/vitest-pool-workers` で DO をテスト

### 構成C: ハイブリッド（Vercel + Cloudflare DO をリアルタイム専用に追加）

- Next.js は Vercel のまま、リアルタイム同期だけ Cloudflare Durable Objects（または tldraw sync テンプレート）に出す
- 運用プラットフォームが3つになる

---

## 3. 比較

| 観点 | A: Supabase | B: Cloudflare | 備考 |
| --- | --- | --- | --- |
| R1 状態機械 | ○ Postgres に `phase`/`step` を持ち、Server Action で遷移 → トリガーで配信 | ◎ DO は単一スレッドの権威サーバーそのもの。レースが構造的に起きない | Bの設計上の最大の魅力 |
| R2 付箋同期 | ○ `broadcast_changes` + スロットル付き Broadcast で十分（行単位・最後勝ち） | ◎ WebSocket 直結で最低レイテンシ | MVP の同期粒度では体感差は出にくい |
| R3 可視性制御 | ◎ **RLS で宣言的に強制**。「自分の票しか SELECT できない」を DB 層で保証し、pgTAP でテスト可能 | △ DO/API のアプリコードで実装。可能だが手続き的で、漏れをテストで担保する責任が全て自前 | ステルス投票は本アプリの核。ここは A が明確に強い |
| R4 プレゼンス／タイマー | ◎ Presence が標準機能。タイマーは `ends_at` 方式 | ○ DO で自前実装（難しくはない） | |
| 認証（Google ログイン） | ◎ **導入・検証済み**（`app/login`、`app/auth/callback`、ローカル手順書あり） | ✕ ゼロから構築。MVP 完走の目的に対する純粋な追加コスト | 最大の差分 |
| テスト戦略 | ◎ CLAUDE.md の方針（Vitest + pgTAP + `supabase test db`）とそのまま一致 | △ pgTAP は使えない。vitest-pool-workers へ移行し、認可テストの考え方を作り直す | リポジトリ規約との整合 |
| ローカル開発 | ◎ `supabase start` 一式が整備済み | ○ wrangler は優秀だが、`@opennextjs/cloudflare` はローカル開発では通常の Next.js ツールを使い、デプロイ時に変換する二段構え | |
| 運用プラットフォーム数 | 2（Vercel + Supabase） | 1（Cloudflare に集約可能） | Bの利点 |
| コスト（MVP規模） | 無料枠で十分 | 無料枠で十分（DO は Free プランで SQLite バックエンドのみ利用可） | 差なし |
| チームの既存資産・学習 | ◎ 既存コード・ドキュメント・スキル（migration/pgTAP）が全て活きる | ✕ ほぼ全て作り直し・学び直し | 「MVPまで走り切る」目的に直結 |
| 将来の拡張（tldraw sync 等） | △ 本格ホワイトボード化するなら別途検討 | ◎ tldraw sync 公式テンプレートは Cloudflare 前提 | 将来カード |

構成Cは「Bの運用集約の利点を捨てて、Aの認証・RLS の利点も得られない」中間解であり、プラットフォームが3つに増えるだけなので推奨しない。

---

## 4. 判断の理由（なぜ A か）

1. **可視性制御が本アプリの核であり、RLS がそれに最適だから。** ステルス投票・個人ワークは「人によって見えるものが違う」機能で、Postgres の RLS なら「自分の行しか読めない」を宣言的に書け、pgTAP で回帰テストできる。Cloudflare 構成でこれをやらないとどうなるか：全ての読み取り経路でアプリコードのフィルタ漏れが即「他人の票が見える」事故になり、それを防ぐテスト基盤も自作することになる。
2. **認証が済んでいるから。** Supabase Auth の Google ログインは動作確認済みで手順書もある。乗り換えると MVP のクリティカルパスに「認証基盤の自作」という PRD に存在しない作業が割り込む。
3. **同期要件が Supabase Realtime の守備範囲に収まっているから。** MVP の同期は行単位の付箋と投票であり、文字単位の共同編集（CRDT）やサーバー権威の高頻度同期は不要。DO の強みが活きる場面がまだ来ていない。
4. **リポジトリの規約・資産と整合するから。** CLAUDE.md は Supabase 前提のテスト方針（pgTAP / `supabase test db`）を定めており、構成Bはこの規約自体の書き換えを要求する。

## 5. Cloudflare へ切り替える判断基準（将来の再評価トリガー）

以下のいずれかが要件化したら、構成B（または C）を再評価する価値がある。

- カーソル共有・自由描画など**サーバー権威の高頻度同期**（実質的な Miro 化）が必要になった
- **tldraw sync の公式採用**を決めた（Cloudflare Workers + Durable Objects テンプレートが公式ルート）
- Supabase Realtime のレート制限・同時接続数が実利用で頭打ちになった
- ルームが DB を必要としないエフェメラルな設計（保存しないワークショップ）へ振ることになった

---

## 6. 実装方針の要点（構成A詳細）

| 機能 | 実装 | 補足 |
| --- | --- | --- |
| ボード UI | React + dnd-kit（または Pointer Events）+ CSS transform の固定サイズ 2D ボードを自作 | tldraw は使わない。必要操作は付箋の作成・編集・ドラッグ・投票ドットのみで、フル描画 SDK は「あえて自由度を絞る」という PRD の思想に反する。tldraw 依存と `/whiteboard` PoC は MVP ではノイズになるため削除を推奨（PoC の知見は `docs/tldraw-supabase-poc.md` に残っている） |
| 付箋 | `notes` テーブル（`room_id`, `phase`, `author_id`, `text`, `x`, `y`, `group_id`, `visibility`） | 個人ワーク中は `visibility = 'private'` + RLS。共有ステップ遷移で一括公開 |
| 投票 | `votes` テーブル + RLS「自分の票のみ SELECT 可」+ 開票は集計 RPC | pgTAP テスト必須（RLS/RPC はアプリケーションコード扱い） |
| フェーズ遷移 | `rooms.phase` / `rooms.step` を Server Action で更新（ホスト検証） | 遷移イベントの取りこぼし対策として、再接続時は DB から現在状態を再取得する |
| ドラッグ同期 | ドラッグ中: 50〜100ms スロットルの Broadcast ／ ドロップ確定: DB 書き込み → `broadcast_changes` | 無間引きで流すと Realtime のレート制限を圧迫する |
| タイマー | `ends_at`（サーバー時刻）を DB に保存、クライアントは差分描画 | ローカル時計基準だと端末間でズレる |
| プレゼンス | Supabase Realtime Presence | |

## 7. リスクと先行検証項目

1. **ドラッグ同期の体感品質（最重要）**: スロットル間隔と受信側の補間次第で「ぬるぬる／カクつき」が決まる。最初の縦切り検証は「2ブラウザで付箋ドラッグが滑らかに同期するか」にする。
2. **Realtime Authorization の設定**: プライベートチャンネル + RLS の組み合わせを最初のスパイクで動作確認する。
3. **フェーズ遷移の整合性**: 遷移中の再接続・遅延クライアントの復帰パスを設計に含める。

---

## 参考

- [Supabase Realtime — Broadcast / Presence / `broadcast_changes`](https://supabase.com/docs/guides/realtime)
- [Cloudflare Durable Objects — WebSocket Hibernation / Pricing（Free プランは SQLite バックエンド）](https://developers.cloudflare.com/durable-objects/)
- [OpenNext Cloudflare アダプタ（`@opennextjs/cloudflare`）](https://opennext.js.org/cloudflare)
- [tldraw sync（自前ホスティング前提。推奨は Cloudflare テンプレート）](https://tldraw.dev/docs/sync)
- [`docs/tldraw-supabase-poc.md`](./tldraw-supabase-poc.md) — DIY Broadcast 同期 PoC の知見と限界
