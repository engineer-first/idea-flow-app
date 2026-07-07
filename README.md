# idea-flow-app

アイデア出しに慣れていないチームが、迷わずアイデアを出し、整理し、1つに絞るための Web アプリ **IdeaFlow** のリポジトリです。

ハッカソン・ビジコン・チーム制作の初期で起きる「何を作ればいいか分からない」「アイデアが出ない」「どれを選べばいいか分からない」といった課題を、発散・整理・選定の流れに沿ったブレスト体験で支援します。Miro や FigJam のような自由なホワイトボードではなく、初学者でも迷わず進められるフレームワーク型のアイデア創出支援を目指しています。

## ドキュメント

プロダクトの詳細（PRD、ペルソナ、競合分析、画面イメージなど）は [idea-flow-app Wiki](https://github.com/engineer-first/idea-flow-app/wiki) にまとめています。仕様や設計の確認は Wiki を参照してください。

技術構成は **Next.js（UI）+ Cloudflare Workers（api-worker）+ Durable Objects（1ルーム = 1 権威サーバー）+ D1（ロビー）** です。採用の経緯と移行の記録は [`docs/refactor-cloudflare-do.md`](docs/refactor-cloudflare-do.md) を参照してください。

## 環境構築

### 前提

- [mise](https://mise.jdx.dev/)（Node.js のバージョン管理に使用）
- Git

Docker や外部サービスのアカウントは不要です（wrangler がローカルで D1 / Durable Objects をエミュレートします）。

### 手順

```bash
git clone git@github.com:engineer-first/idea-flow-app.git
cd idea-flow-app

# mise で Node.js LTS をインストール（初回のみ）
mise install

# 依存関係のインストール
npm ci

# 環境設定ファイルをコピー
cp .env.example .env.local

# D1（ローカル）に migration を適用（初回のみ）
npm run db:migrate

# ターミナル1: api-worker（D1 + Durable Objects）を起動
npm run dev:api

# ターミナル2: Next.js 開発サーバーを起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて動作を確認できます。

### 認証のローカル開発

本番のログインは Google 認証（OIDC）のみを想定しています。ローカル開発では、固定のメール/パスワードユーザーでログインできます（`NEXT_PUBLIC_ENABLE_DEV_AUTH=true` かつ production 以外の環境でだけ表示されます）。

固定ユーザー（初回ログイン時に自動作成されるため、シードは不要です）:

| メール                | パスワード |
| --------------------- | ---------- |
| `owner@example.test`  | `password` |
| `member@example.test` | `password` |
| `viewer@example.test` | `password` |

Google ログインを確認する場合は、Google Cloud Console で OAuth クライアントを作成し、`.env.local` に `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を設定してください（リダイレクト URI は `http://localhost:3000/auth/callback`）。

### よく使うコマンド

| コマンド               | 説明                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Next.js 開発サーバーを起動                                  |
| `npm run dev:api`      | api-worker（D1 + Durable Objects）をローカル起動            |
| `npm run db:migrate`   | ローカル D1 に migration を適用                             |
| `npm run build`        | Next.js 本番ビルド                                          |
| `npm run build:cf`     | Cloudflare Workers 向けビルド（OpenNext）                   |
| `npm run preview:cf`   | Workers 向けビルドを workerd 上でローカル実行（2構成同時）  |
| `npm run lint`         | Biome による静的解析 (lint + format チェック)               |
| `npm run fix`          | Biome の自動修正 (lint + format)                            |
| `npm run format`       | Biome でファイルを一括フォーマット                          |
| `npm run test`         | アプリ側ユニットテストを実行 (CI でも実行)                  |
| `npm run test:workers` | Worker / Durable Object のテストを workerd 上で実行         |
| `npm run typecheck`    | 型検査（Worker の型生成込み）                               |

### デプロイ（Cloudflare）

1. `wrangler d1 create idea-flow-lobby` で D1 を作成し、`workers/wrangler.jsonc` の `database_id` を置き換える
2. `wrangler secret put SESSION_SECRET --config workers/wrangler.jsonc` で本番秘密鍵を設定する
3. `wrangler deploy --config workers/wrangler.jsonc` で api-worker をデプロイする
4. `npm run build:cf && wrangler deploy` で Next.js ワーカーをデプロイする

### MSW (Mock Service Worker)

- **ブラウザ (dev)** は `.env.local` の `NEXT_PUBLIC_USE_MSW` で制御します
  - 有効化: `NEXT_PUBLIC_USE_MSW=true` をセット
  - 無効化: `false` にする (または行ごと削除)

Node.js のバージョンは `mise.toml` で LTS に固定しています。CI でも同じ mise 設定を使用しています。

### MCP サーバー (Claude Code などのエージェント向け)

`.mcp.json` でプロジェクト共通の MCP サーバーを定義しています。

- **playwright** — 実ブラウザでの UI 確認・スクリーンショット取得に使用します

## スクラム運用

- [学校スクラム開発のホワイトボードと GitHub Projects 連携](docs/scrum/whiteboard-github-projects.md)

## ドキュメントのフォーマット

Markdown の整形には VS Code 拡張 [Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one) を使用します（テーブルの列幅を全角文字幅を考慮して自動で揃えてくれます）。

リポジトリを開いたら、推奨拡張機能として案内される **Markdown All in One** をインストールしてください。`.vscode/settings.json` により保存時に自動整形されます。

## 命名規則

| 対象                 | 規則         | 例                                                    |
| -------------------- | ------------ | ----------------------------------------------------- |
| ファイル名           | `kebab-case` | `idea-card.tsx`, `use-idea-list.ts`, `format-date.ts` |
| 関数名               | `camelCase`  | `getUserName`                                         |
| スキーマ名 (型・zod) | `PascalCase` | `User`, `Idea`, `IdeaStatus`                          |
