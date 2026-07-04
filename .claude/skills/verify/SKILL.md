---
name: verify
description: このリポジトリの変更をローカルで起動して実際に動かして検証する手順。dev サーバー起動、ログイン、ルーム作成、付箋操作の検証レシピ。
---

# 検証手順（poc-realtime-note-sync）

## 前提

- ローカル Supabase が必要: `npx supabase status` で確認、止まっていれば `npm run supabase:start`。
- `.env.local` が必要。`supabase status` の値から作る:
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ← PUBLISHABLE_KEY
  - `SUPABASE_SERVICE_ROLE_KEY` ← SERVICE_ROLE_KEY
  - 残りは `.env.example` のデフォルトでよい（`NEXT_PUBLIC_ENABLE_DEV_AUTH=true` を忘れない）
- 開発用ユーザー: `npm run seed:dev-users`（owner@example.test / password）

## 起動と導線

1. `npm run dev`（バックグラウンド、ログをファイルへ）。**ポート注意**: 別 worktree の dev サーバーが 3000 を掴んでいると 3001 に逃げる。ログの `Local:` を必ず確認。
2. `/login` → 「開発用ユーザーでログイン」→ `/` → 「ルームを作成」→ `/rooms/{id}`。
3. 「付箋を追加」で付箋を作成。

## 検証の観測点

- Server Action の実行は dev サーバーログに出る（`ƒ createNote(...)`, `updateNotePosition(...)` など）。永続化の証拠はここで取る。
- 付箋の状態は data 属性で観測できる: `[data-testid="note-card"]` の `data-selected` / `data-editing`。
- 選択・ドラッグ・キー操作のサーフェスはカード内の `button[aria-label="付箋"]`（編集中はアンマウントされる）。

## 落とし穴

- Playwright MCP（Orca 埋め込みブラウザ）ではネイティブ入力注入（`.click()` / `page.mouse`）がページに届かないことがある。その場合は合成イベントで代替:
  - `PointerEvent` を `dispatchEvent`（`bubbles: true, pointerId: 1` で clientX/clientY 指定）
  - 事前に `HTMLElement.prototype.setPointerCapture = function(){}` で no-op 化（実ポインターが無いと NotFoundError になるため）
  - React 制御の textarea への入力は native setter + `input` イベント dispatch
- Server Action の form 送信も同様に `.click()` が効かないことがある → `form.requestSubmit()` を evaluate で呼ぶ。
