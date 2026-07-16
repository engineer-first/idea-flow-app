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
cp .env.example .env.local                       # Next.js 側
cp workers/.dev.vars.example workers/.dev.vars   # api-worker 側の秘密（gitignore 済み）

# D1（ローカル）に migration を適用（初回のみ）
npm run db:migrate

# ターミナル1: api-worker（D1 + Durable Objects）を起動
npm run dev:api

# ターミナル2: Next.js 開発サーバーを起動
npm run dev
```

ブラウザで <http://localhost:3000> を開いて動作を確認できます。

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

| コマンド                                    | 説明                                                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                               | Next.js 開発サーバーを起動                                                                                                                                                                                                     |
| `npm run dev:api`                           | api-worker（D1 + Durable Objects）をローカル起動                                                                                                                                                                               |
| `npm run db:migrate`                        | ローカル D1 に migration を適用                                                                                                                                                                                                |
| `npm run new:room-do-migration -- 短い説明` | RoomDO migration の `.sql` スタブをタイムスタンプ付きで作成（例: `-- add-note-kind`）。コミットするのは `.sql` だけ（集約 `index.ts` は gitignore 済みの生成物で、`npm ci` / `test:workers` / `dev:api` などが自動再生成する） |
| `npm run build`                             | Next.js 本番ビルド                                                                                                                                                                                                             |
| `npm run build:cf`                          | Cloudflare Workers 向けビルド（OpenNext）                                                                                                                                                                                      |
| `npm run deploy:api`                        | api-worker をデプロイ                                                                                                                                                                                                          |
| `npm run deploy:app`                        | app-worker をビルド + デプロイ（api → app の順が必要な場合は `npm run deploy`）                                                                                                                                                |
| `npm run deploy`                            | api → app の順で両方デプロイ                                                                                                                                                                                                   |
| `npm run preview:cf`                        | Workers 向けビルドを workerd 上でローカル実行（2構成同時）                                                                                                                                                                     |
| `npm run lint`                              | Biome による静的解析 (lint + format チェック)                                                                                                                                                                                  |
| `npm run fix`                               | Biome の自動修正 (lint + format)                                                                                                                                                                                               |
| `npm run format`                            | Biome でファイルを一括フォーマット                                                                                                                                                                                             |
| `npm run test`                              | アプリ側ユニットテストを実行 (CI でも実行)                                                                                                                                                                                     |
| `npm run test:workers`                      | Worker / Durable Object のテストを workerd 上で実行                                                                                                                                                                            |
| `npm run typecheck`                         | 型検査（Worker の型生成込み）                                                                                                                                                                                                  |

### デプロイ（Cloudflare）

#### アーキテクチャ

| Worker          | 設定ファイル             | 役割                                                         |
| --------------- | ------------------------ | ------------------------------------------------------------ |
| `idea-flow-app` | `wrangler.jsonc`         | UI（Next.js / OpenNext）+ `/api/*` を service binding で転送 |
| `idea-flow-api` | `workers/wrangler.jsonc` | REST + WebSocket（D1 / RoomDO への唯一の入口）               |

本番では api-worker を service binding で呼ぶため、`API_WORKER_URL` / `NEXT_PUBLIC_API_WORKER_URL` は**設定しない**（誤設定すると到達不能になる危険があります）。

#### 必要な秘密・環境変数

**api-worker (`idea-flow-api`)**

| 名前             | 設定方法                                              | 備考                          |
| ---------------- | ----------------------------------------------------- | ----------------------------- |
| `SESSION_SECRET` | `wrangler secret put --config workers/wrangler.jsonc` | 32 バイト以上。app 側と同一値 |

**app-worker (`idea-flow-app`)**

| 名前                          | 種別                                                             | 備考                                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`              | `wrangler secret put`（root の `wrangler.jsonc` に対し実行）     | api 側と同一値                                                                                                                                                                         |
| `GOOGLE_CLIENT_ID`            | `wrangler secret put`                                            | 本番ログイン用                                                                                                                                                                         |
| `GOOGLE_CLIENT_SECRET`        | `wrangler secret put`                                            | 本番ログイン用                                                                                                                                                                         |
| `NEXT_PUBLIC_SITE_URL`        | `wrangler.jsonc` の `vars` または `wrangler deploy` 時の `--var` | 本番 URL（例 `https://app.example.com`）。production では必須。招待 URL・OAuth redirect のベースになる。ビルド時に埋め込まれるため、デプロイ前の `build:cf` 時点で有効である必要がある |
| `NEXT_PUBLIC_ENABLE_DEV_AUTH` | 設定しない                                                       | 本番では development 環境以外で自動無効                                                                                                                                                |
| `NEXT_PUBLIC_API_WORKER_URL`  | **設定しない**                                                   | 本番は同一オリジン                                                                                                                                                                     |
| `API_WORKER_URL`              | **設定しない**                                                   | 本番は service binding                                                                                                                                                                 |

#### 初回デプロイ手順

デプロイ順は **api → app**（service binding 先が先に存在する必要があるため）。

```bash
# 1. D1 作成 → 出力の database_id を workers/wrangler.jsonc に書く
npx wrangler d1 create idea-flow-lobby

# 2. D1 migration をリモート適用
npx wrangler d1 migrations apply DB --remote --config workers/wrangler.jsonc

# 3. 秘密生成（例）
openssl rand -base64 48

# 4. api-worker の秘密設定
npx wrangler secret put SESSION_SECRET --config workers/wrangler.jsonc

# 5. api-worker をデプロイ
npm run deploy:api

# 6. app-worker の秘密設定（root の wrangler.jsonc を使う）
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# 7. 本番 URL を指定してビルド + デプロイ
export NEXT_PUBLIC_SITE_URL=https://idea-flow-app.<subdomain>.workers.dev
npm run deploy:app
```

#### カスタムドメイン設定

`idea-flow-app` にだけドメインを付ける（api は service binding で閉じる）。

```bash
# デプロイ時にドメインを指定
npx wrangler deploy -c wrangler.jsonc --domains app.example.com
```

または Dashboard（Workers → idea-flow-app → Settings → Domains & Routes）から設定。

Google OAuth のリダイレクト URI に `https://app.example.com/auth/callback` を追加する。
ドメイン変更時は `NEXT_PUBLIC_SITE_URL` を更新して**再ビルド必須**。

#### 動作確認

1. トップ表示・Google ログイン
2. ルーム作成 → 招待コード表示
3. 別ブラウザ/シークレットで参加
4. 付箋追加が双方にリアルタイム反映
5. 退出・ホスト解散

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

Markdown の整形には [remark](https://github.com/remarkjs/remark) を使用します。設定は `.remarkrc.mjs` に集約されており、VS Code 拡張 [remark](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-remark)（保存時整形）と CLI（`.claude/hooks/format-on-edit.sh` 経由のAIエージェント編集時整形、`npm run format:md`）が同じ設定・同じ実装を共有するため、人間が保存したときとAIが編集したときで整形結果が一致します。テーブルは `remark-gfm` の `stringLength` に `string-width` を渡すことで、全角文字幅を考慮した列揃えに対応しています。拡張子ごとの Biome/remark 振り分けは `scripts/format-file.sh` に一本化されており、Claude Code・opencode（`opencode.json` の `formatter`）・Codex CLI（`.codex/hooks.json` 経由の `scripts/format-changed-files.sh`）はいずれもこのスクリプトを共通で呼び出します。

リポジトリを開いたら、推奨拡張機能として案内される **remark** をインストールしてください。

## 命名規則

| 対象                 | 規則         | 例                                                    |
| -------------------- | ------------ | ----------------------------------------------------- |
| ファイル名           | `kebab-case` | `idea-card.tsx`, `use-idea-list.ts`, `format-date.ts` |
| 関数名               | `camelCase`  | `getUserName`                                         |
| スキーマ名 (型・zod) | `PascalCase` | `User`, `Idea`, `IdeaStatus`                          |
