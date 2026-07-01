# idea-flow-app

アイデア出しに慣れていないチームが、迷わずアイデアを出し、整理し、1つに絞るための Web アプリ **IdeaFlow** のリポジトリです。

ハッカソン・ビジコン・チーム制作の初期で起きる「何を作ればいいか分からない」「アイデアが出ない」「どれを選べばいいか分からない」といった課題を、発散・整理・選定の流れに沿ったブレスト体験で支援します。Miro や FigJam のような自由なホワイトボードではなく、初学者でも迷わず進められるフレームワーク型のアイデア創出支援を目指しています。

## ドキュメント

プロダクトの詳細（PRD、ペルソナ、競合分析、画面イメージなど）は [idea-flow-app Wiki](https://github.com/engineer-first/idea-flow-app/wiki) にまとめています。仕様や設計の確認は Wiki を参照してください。

## 環境構築

### 前提

- [mise](https://mise.jdx.dev/)（Node.js のバージョン管理に使用）
- Git

### 手順

```bash
git clone git@github.com:engineer-first/idea-flow-app.git
cd idea-flow-app

# mise で Node.js LTS をインストール（初回のみ）
mise install

# 依存関係のインストール
npm ci

# 開発サーバーの起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて動作を確認できます。

### 認証のローカル開発

MVP本番のログインはGoogle認証のみを想定しています。ローカル開発では、Google認証に加えて固定のメール/パスワードユーザーでログインできます。

```bash
cp .env.example .env.local
npm run supabase:start
npx supabase status -o env

# 表示されたローカルのpublishable key / service_role keyを.env.localに反映してから実行
npm run seed:dev-users
npm run dev
```

開発用ログインは`NEXT_PUBLIC_ENABLE_DEV_AUTH=true`かつproduction以外の環境でだけ表示されます。

固定ユーザー:

| メール                | パスワード |
| --------------------- | ---------- |
| `owner@example.test`  | `password` |
| `member@example.test` | `password` |
| `viewer@example.test` | `password` |

ローカルSupabaseでGoogle認証も確認する場合は、Google Cloud側に`http://127.0.0.1:54321/auth/v1/callback`をAuthorized redirect URIとして登録し、`supabase/config.toml`の`[auth.external.google]`を`enabled = true`に変更してから、Google client id / secretを環境変数に設定してSupabaseを再起動します。

### よく使うコマンド

| コマンド                            | 説明                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| `npm run dev`                       | 開発サーバーを起動                                       |
| `npm run supabase:start`            | ローカルSupabaseを起動                                   |
| `npm run supabase:stop`             | ローカルSupabaseを停止                                   |
| `npm run supabase:stop --no-backup` | ローカルSupabaseの完全停止(データをすべて削除して初期化) |
| `npm run seed:dev-users`            | 開発用固定ユーザーを作成・更新                           |
| `npm run build`                     | 本番ビルド                                               |
| `npm run lint`                      | Biome による静的解析 (lint + format チェック)            |
| `npm run fix`                       | Biome の自動修正 (lint + format)                         |
| `npm run format`                    | Biome でファイルを一括フォーマット                       |
| `npm run test`                      | ユニットテストを実行 (CI でも実行)                       |
| `npm run test:coverage`             | ユニットテストを実行しカバレッジを表示                   |

Node.js のバージョンは `mise.toml` で LTS に固定しています。CI でも同じ mise 設定を使用しています。

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
