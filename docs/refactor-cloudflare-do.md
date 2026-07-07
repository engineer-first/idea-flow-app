# Cloudflare Durable Objects 構成へのリファクタリング記録

> 開始日: 2026-07-07
> ブランチ: `junhat6/refactor-cloudflare-do`（`junhat6/poc-realtime-note-sync` 起点）
> 目的地: Next.js on Cloudflare Workers（OpenNext）+ 1ルーム = 1 Durable Object + D1
> 背景: 技術再評価（実装負荷を除外した比較）で第1推奨となった構成への移行。
> 方針の全体像・移行原則・フェーズ計画は本ドキュメント末尾の「参照」を参照。

## Phase 0: ゲート検証（完了）

目的地の成立条件3点を実物で検証した。**すべて成立**したため、フォールバック
（ハイブリッド構成 = Next を Vercel に残し RoomDO だけ Cloudflare）は不要と判断し、
フル Cloudflare 構成で確定した。

| ゲート | 内容 | 結果 |
| --- | --- | --- |
| A | `@opennextjs/cloudflare` 1.20.1 で Next 16.2.9 がビルド・起動できるか | ✅ ビルド成功。`wrangler dev`（workerd）上で `/login` が HTTP 200・正しい HTML を返すことを確認 |
| B | Durable Object + WebSocket（Hibernation API）の最小動作 | ✅ upgrade 受け入れ・メッセージ往復をテストで確認 |
| C | `@cloudflare/vitest-pool-workers` 0.18.0 が Vitest 4.1.9 と共存できるか | ✅ peer deps が `vitest ^4.1.0`。スモークテスト 2件 pass |

### ゲート A の条件: proxy.ts の削除

- Next 16 の `proxy.ts`（旧 middleware）は **Node.js ランタイム固定**で、`runtime` 設定は
  エラーになる（`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`）。
- OpenNext Cloudflare アダプタは Node ランタイムの Proxy を未サポートのため、ビルドが
  `ERROR Node.js middleware is not currently supported` で失敗する。
- 現行の `proxy.ts` は Supabase セッションの Cookie リフレッシュ専用であり、認証層を
  置き換える本リファクタリングでは Phase 1 で不要になる。Next 公式ドキュメント自身も
  「Proxy に頼らず、各 Server Function 内で認証・認可を検証せよ」と推奨しており、
  現行コードは既に各 Server Action / ページで `getCurrentUser()` を検証している。
  → **Phase 0 で削除**した。Phase 1 完了までの間、長時間セッションのトークン
  リフレッシュが働かない過渡状態になるが、ブランチ内の一時的な状態として許容する。

### ゲート C の注意: 設定 API の変更

`@cloudflare/vitest-pool-workers` 0.18（Vitest 4 対応版）で設定方法が変わっている。

- 旧: `defineWorkersConfig` + `test.poolOptions.workers`（`/config` エクスポートは削除済み）
- 新: `cloudflareTest()` を Vite プラグインとして `plugins` に渡す（`vitest.workers.config.mts` 参照）

### 追加したもの

- `open-next.config.ts` — 最小構成（ISR/SSG キャッシュ層なし。認証必須の動的ページのみのため）
- `wrangler.jsonc` — 本番用 Worker 構成（Phase 1 でカスタムエントリへ差し替え予定）
- `workers/` — RoomDO の骨格・テストエントリ・テスト用 wrangler 構成・workers 専用 tsconfig
- `vitest.workers.config.mts` — workerd 実行のテスト設定（アプリ側 jsdom とは分離）
- npm scripts: `test:workers` / `build:cf` / `preview:cf`、`typecheck` は workers も検査

## Phase 1: 土台 — 認証・D1・api-worker（完了）

認証層とロビー（ルーム作成・招待コード参加）を Supabase から新基盤へ置き換えた。

### アーキテクチャ上の決定

- **api-worker（`workers/`）が D1 と RoomDO への唯一の入口**。Next は UI と
  セッション Cookie の発行だけを担う。D1 型を Next の tsconfig（DOM lib）に
  持ち込むと型空間が衝突すること、D1 を触るコードは workers テスト（実 miniflare D1）
  でしか統合テストできないことが理由。
- **セッションは HS256 JWT の HttpOnly Cookie**（`jose`、TTL 7日）。Next と
  api-worker が SESSION_SECRET を共有して検証する。audience で「セッション」と
  「ログイン主張」を分離し、トークンの用途間流用を防ぐ。
- **ログイン主張（LoginAssertion）**: ログイン確定時、Next が署名した短命トークンを
  api-worker `/api/auth/sync` へ渡してユーザーを D1 に upsert する。無認証の
  書き込みエンドポイントを作らないための設計。
- **Google ログインは OIDC code flow を直接実装**（Supabase Auth の代替）。
  state/nonce Cookie で CSRF・リプレイを防ぎ、id_token は Google の JWKS で検証する。
  開発ログインは従来どおり固定3ユーザー（ID は安定 UUID に変更）。
- **メンバーシップの真実は RoomDO**（DO 内蔵 SQLite）。D1 の rooms 行は
  「招待コード → ルーム解決」のディレクトリにすぎない。ルームの存在を
  非メンバーに漏らさないよう、非メンバー・不存在とも同じ 404 を返す。

### テスト

- workers 統合テスト 30件（`npm run test:workers`）: pgTAP 28件のうちロビー・認可に
  関わる仕様（anon 拒否 / 非メンバー404 / join 冪等 / create が host を1件だけ登録）を移植。
  付箋の列権限に相当する仕様は Phase 2 の WS プロトコルテストで移植する。
- アプリ側 78件: トークン署名/検証（jose は jsdom と相性が悪いため node 環境指定）を追加。

### 実機確認（完了条件）

`npm run db:migrate` + `npm run dev:api` + `next dev` で以下を curl 実弾確認:

- 未認証の `/api/rooms` POST → 401
- dev ログインフォームの no-JS POST → 303 + セッション Cookie 発行（D1 upsert 込み）
- ルーム作成 → `{roomId, inviteCode}`（コードは 0/O/1/I 除外アルファベット）
- 非メンバーのルーム取得 404 → join（小文字空白まじりコード補正）→ 200
- Next のルームページ: メンバー 200 / 不存在 404

### 過渡状態（Phase 3 で解消）

- 付箋 CRUD の Server Actions と room-board の Realtime 購読はまだ Supabase 実装のまま。
  ボードは表示されるが同期は動かない。
- 旧 `lib/supabase/*`・`supabase/` ディレクトリは Phase 4 で撤去する。

## Phase 2: RoomDO — コントラクトと権威サーバー（完了）

付箋の確定状態と配信の権威を RoomDO へ実装した。

### コントラクト層（先行定義）

- `contracts/room-protocol.ts` — クライアント ↔ RoomDO の全メッセージを zod で定義。
  **authorId / roomId を書き換えるメッセージは存在しない**。Supabase 時代に
  列レベル GRANT で塞いだ権限昇格攻撃（author_id 書き換えによる DELETE 迂回、
  room_id 書き換えによる持ち出し）を、プロトコルの形そのもので構造的に塞いだ。
- `contracts/board.ts` — ボード定数を app/rooms からコントラクト層へ移動
  （旧ファイルは再エクスポートとして残し、UI の import は不変）。

### 可視性の一点集約

- `workers/visibility.ts` の `visibleTo()` — スナップショットの絞り込みも
  配信の宛先判定も必ずこの関数を通る。現仕様は「メンバー全員が全付箋を見られる」
  だが、個人ワーク・ステルス投票のフェーズ導入時はこの関数への分岐追加 +
  `visibility.spec.ts` のテーブル追加だけで拡張する。

### RoomDO の実装

- DO 内蔵 SQLite に members / notes / meta。単一スレッド直列化により
  同時編集・フェーズ遷移のレースは構造的に発生しない。
- `note:drag` は永続化せず送信者以外へ配信（エコーなし。クライアントの
  巻き戻り防止をサーバー側の仕様にした）。確定は `note:move` のみ。
- 再接続時は接続直後の snapshot で全確定状態へ復帰する（R1 復帰パス）。
- 存在しない付箋のドラッグは黙って捨てる（高頻度メッセージにエラー往復をしない）。

### テスト（workers 45件）

pgTAP の付箋認可仕様をプロトコル境界のテストとして移植:

- author でないメンバーも content / 位置を更新できる（共同編集）＋ authorId 不変
- author 以外の削除は forbidden で拒否され付箋は残る
- 入力検証（2000文字上限・ボード範囲外・不正 JSON）は invalid-message で拒否、接続は維持
- drag のエコー無し・非永続を配信順序と再接続 snapshot で検証

## Phase 3: UI 再配線（完了）

継ぎ目（`room-board.tsx`）の内側を Supabase 購読 + Server Actions から
WebSocket クライアントへ差し替えた。**BoardView / NoteCard / notes-reducer /
throttle は無変更**（PoC 時の「テスト可能な純粋ロジックを分離する」設計の配当）。

### 追加したもの

- `lib/room-client/` — フレームワーク非依存の WS クライアント。
  指数バックオフの自動再接続つき（再接続後はサーバーが snapshot を送る契約
  なので、クライアント側で差分の取りこぼしを追跡しない）。
  PoC の既知の制限「トークンリフレッシュ時の再認可」も、再接続時に Cookie で
  再認可される形で解消。
- `app/rooms/[id]/room-board.spec.tsx` — フェイク WebSocket 注入による
  コンテナ統合テスト（サーバーメッセージ → 画面反映、操作 → メッセージ送信の双方向）。

### 挙動の変更（意図的）

- **削除の楽観更新をやめた**: author 以外の削除はサーバーが forbidden で拒否する
  ため、確定（note:deleted）を待ってから消す。PoC の既知の制限
  「楽観更新済みUIの巻き戻しなし」を、この操作については解消した。
- **付箋作成も確定待ち**: ID 生成をサーバーへ一本化。RoomDO は同 colo の
  単一オブジェクトなので往復は短い。
- 本文編集の楽観更新は維持（入力の見た目を止めないため）。

### 実機 E2E（実ブラウザ + 対向クライアント）

Playwright で実ブラウザを操作して確認:

1. 開発用ログイン（実フォーム）→ セッション Cookie 発行 → ホーム表示
2. 「ルームを作成」→ `/rooms/<uuid>` へ遷移、招待コード表示、空ボード描画
3. 2本目の WS 接続（対向クライアント相当）が snapshot を受信
4. UI で「付箋を追加」→ 対向クライアントが `note:inserted` を**ライブ受信**
5. 対向クライアントから `note:drag` 送信 → **UI の付箋が (916,687)→(150,250) へライブ移動**

### 撤去したもの

- 付箋 CRUD の Server Actions（`app/rooms/actions.ts` はロビー専用になった）
- `room-board.tsx` の Supabase Realtime 購読

この時点で Supabase への参照は `lib/supabase/*`（未使用）と
`app/whiteboard/`（tldraw PoC）だけになり、Phase 4 で撤去する。

## 参照

- 技術再評価メモ: <https://junhat6.github.io/claude-artifacts/2026-07-07-ideaflow-stack-reeval.html>
- [`docs/tech-stack-research.md`](./tech-stack-research.md) — 移行前の比較調査（実装負荷込みの評価）
- [`docs/realtime-note-sync-poc.md`](./realtime-note-sync-poc.md) — 移植元 PoC の計測値・認可仕様・手動確認手順
