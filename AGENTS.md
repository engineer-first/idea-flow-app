# エージェント指示

- このファイルをリポジトリ全体の真実として扱う。
- `CLAUDE.md` は `AGENTS.md` への symlink として維持する。
- 指示は短く、最新に保ち、重複させない。
- すべてのアプリケーションコードで TypeScript strict mode を使う。
- 公開境界では明示的な型を優先する。
- コンパイラ、lint、テスト設定を緩めて通そうとしない。
- 振る舞いを変更するときはTDD に従う。
- テストは原則として Vitest を使う。
- 例外は `supabase test db` や pgTAP など、このファイルで専用ツールを明記している場合だけにする。
- Next.js の作業では、実装前に `node_modules/next/dist/docs/` の関連ガイドを読む。

## リポジトリ構成

- `app/` — Next.js App Router + React + TypeScript のフルスタックアプリ。
- `app/**/route.ts` — Route Handler による API 境界。
- Server Actions — UI 近傍に置けるサーバー処理。認可と入力検証を必須にする。
- `supabase/` — Supabase migration と pgTAP テスト。
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
- Supabase と外部 API 通信は MSW でモックする。
- コンポーネント内に生のテストデータをハードコードしない。
- fixture、handler、builder はコンポーネントファイルの外に置く。
- UI がデータに依存する場合は loading、empty、success、error 状態をテストする。

## API とサーバー処理（Route Handler / Server Action + Supabase）

- API 境界には Route Handler または Server Action を使う。
- API 境界で入力を検証する。
- API 境界で認可を強制する。
- Supabase service role key をブラウザコードに公開しない。
- API レスポンスは型付けし、最小限に保つ。
- データベースエラーを漏らさず、明示的なエラー状態を優先する。

## データベースとセキュリティ（Supabase）

- RLS、trigger、RPC はテスト済みのアプリケーションコードとして扱う。
- クライアントコードを楽にするために RLS policy を緩めない。
- 特権的なデータベースワークフローには RPC を優先する。
- migration は意図として戻せる形にし、スコープを最小限に保つ。
- RLS、trigger、RPC を変更するたびに `supabase/tests/` 配下へ pgTAP SQL テストを追加する。
- データベース変更は `supabase test db` で検証する。

## 境界ルール

- UI、Server Actions、Route Handlers、Supabase 呼び出しの境界を常に意識する。
- データベースセキュリティルールを UI コンポーネントに入れない。
- ブラウザコードに service role secret や特権的なデータベースアクセスを含めない。
- 外部データアクセスは型付き API 境界、または MSW handler のモックを経由させる。
- API とサーバーサイド TypeScript のテストには Vitest を使う。
- unauthorized、forbidden、invalid input、success、database error の各経路をテストする。
