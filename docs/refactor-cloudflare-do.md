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

## 参照

- 技術再評価メモ: <https://junhat6.github.io/claude-artifacts/2026-07-07-ideaflow-stack-reeval.html>
- [`docs/tech-stack-research.md`](./tech-stack-research.md) — 移行前の比較調査（実装負荷込みの評価）
- [`docs/realtime-note-sync-poc.md`](./realtime-note-sync-poc.md) — 移植元 PoC の計測値・認可仕様・手動確認手順
