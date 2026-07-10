# エージェント指示

- このファイルをリポジトリ全体の真実として扱う。
- 指示は短く、最新に保ち、重複させない。
- 公開境界では明示的な型を優先する。
- コンパイラ、lint、テスト設定を緩めて通そうとしない。
- コードレビューのコメント、説明、提案、要約は日本語で書く。
- 振る舞いを変更するときはTDD に従う。
- テストは Vitest を使う。Worker / Durable Object のテストは
  `@cloudflare/vitest-pool-workers`（`npm run test:workers`）で行う。
- Next.js の作業では、実装前に `node_modules/next/dist/docs/` の関連ガイドを読む。

## リポジトリ構成

- `app/` — Next.js App Router + React + TypeScript の UI 層。
- `contracts/` — 境界スキーマ（zod）。WS プロトコル・REST・セッション・ボード定数。
  クライアントとサーバーの両方がここを import する。実装より先にここを変える。
- `workers/` — Cloudflare Workers 側。`api-worker.ts`（D1 + RoomDO への唯一の入口）、
  `room-do.ts`（1ルーム = 1 Durable Object の権威サーバー）、`migrations/`（D1）。
- `lib/session/` — セッション（HS256 JWT Cookie）の発行・検証。
- `lib/room-client/` — ルーム WebSocket クライアント（自動再接続つき）。
- Server Actions — UI 近傍に置けるサーバー処理。認可と入力検証を必須にする。
- `node_modules/next/dist/docs/` — Next.js の挙動を変更する前に読む必須ドキュメント。

## 命名規則

| 対象 | 規則 | 例 |
| --- | --- | --- |
| ファイル名 | `kebab-case` | `idea-card.tsx`, `use-idea-list.ts`, `format-date.ts` |
| 関数名 | `camelCase` | `getUserName` |
| スキーマ名（型・zod） | `PascalCase` | `User`, `Idea`, `IdeaStatus` |

- Next.js の予約ファイル名は App Router の規約に従う。
- 例: `page.tsx`、`layout.tsx`、`route.ts`、`loading.tsx`、`error.tsx`。

## 開発プロセス（TDD）

- 振る舞いの変更は、原則として失敗する Vitest テストから始める。
- 実装前に failing test を確認する。
- サイクルは「失敗するテスト -> 実装 -> リファクタリング」で進める。
- 実装後に同じテストが green になることを確認する。
- テストは観測可能な振る舞いに集中させる。
- 変更が小さく見えてもテストを省略しない。
- 失敗するテストが存在する前に本番コードを変更しない。
- リファクタリングはテストが green になってから行う。

## フロントエンドと UI（Next.js + Vitest + Storybook + MSW）

- UI 作業では Next.js App Router と React を使う。
- Next.js の挙動を変更する前に `node_modules/next/dist/docs/` の関連ガイドを読む。
- テストには Vitest を使う。
- テストファイル名は `*.spec.ts` または `*.spec.tsx` にする。
- すべての UI コンポーネントに `*.stories.tsx` を作成する。
- Storybook を通じて component-driven に UI を構築する。
- 外部 API 通信は MSW でモックする。WebSocket はフェイクの注入
  （`webSocketFactory`）でモックする。
- コンポーネント内に生のテストデータをハードコードしない。
- fixture、handler、builder はコンポーネントファイルの外に置く。
- UI がデータに依存する場合は loading、empty、success、error 状態をテストする。

## API とサーバー処理（api-worker / Server Action / Route Handler）

- データ（D1・RoomDO）への到達は必ず `workers/api-worker.ts` を経由する。
  Next 側から D1 や DO を直接触らない。
- API 境界で入力を検証する（コントラクトは `contracts/` の zod スキーマ）。
- API 境界で認可を強制する。認証が必要な箇所は毎回 `getCurrentUser()` /
  `getSessionFromRequest()` を通す（Proxy には頼らない。Next 公式の推奨）。
- API レスポンスは型付けし、最小限に保つ。

## リアルタイムとセキュリティ（Durable Objects）

- ルームの中の真実（メンバー・付箋）は RoomDO だけが持つ。D1 の rooms 行は
  「招待コード -> ルーム解決」のディレクトリにすぎない。
- 可視性の判定は `workers/visibility.ts` の `visibleTo()` に一点集約する。
  スナップショットにも配信にも、この関数を経由しない送信経路を作らない。
- 可視性・認可のルールを変えたら、`visibility.spec.ts` のテーブルと
  `workers/*.spec.ts` の否定系テストを必ず更新する。否定系
  （非メンバー・非author・未認証が「できない」こと）を先に書く。
- クライアントに書き換えさせたくないフィールド（authorId / roomId など）は、
  プロトコルのメッセージに含めない。認可チェックではなく形で塞ぐ。
- D1 migration は意図として戻せる形にし、スコープを最小限に保つ。
  適用は `npm run db:migrate`（ローカル）。
- D1 migration または `room-do-migrations.ts` を変更すると、Storybook の
  `Schema/SchemaDiagram`（`components/schema-diagrams/`）の ER 図に自動反映
  される（`npm run storybook` / `build-storybook` が `tbls` で再生成する）。
  Chromatic が develop との見た目の差分を検出するため、手動生成やコミットは
  不要。D1 と RoomDO は物理的に別ストレージで DB レベルの結合を持たないため、
  ER 図もあえて分離している（1枚に混ぜて結合があるように見せない）。

## 境界ルール

- UI、Server Actions、api-worker、RoomDO の境界を常に意識する。
- ブラウザコードにセッション秘密鍵や特権的なデータアクセスを含めない。
- 境界を流れるデータの形は `contracts/` が真実。実装層は再生成可能に保つ。
- API とサーバーサイド TypeScript のテストには Vitest を使う。
  workerd 実行が必要なもの（DO・D1・WS）は `npm run test:workers`。
