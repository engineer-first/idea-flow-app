# C′ 移行ブリーフ — feature 内 5 箱（依存権の帯）への移行 + コンポーネント見直し

このファイルは実装セッションへの指示書。設計の全文・攻撃的検証の結果・
先行事例は [feature-ui-directory-options.md](feature-ui-directory-options.md)
の「C を成立させる設計 — C′」の節が真実。**先にそこと AGENTS.md を読む**こと。
案の比較（B vs C′）は決着済みなので再検討しない。

## 決定事項（2026-07-13、チーム合意）

- feature 内を ui / logic の 2 層から、5 箱に移行する:
  `containers / templates / organisms / molecules / logic`。
- 帯規則は 3 つ: **上向き import 禁止・skip 合法・同帯合法**。
  箱は「本質の分類」ではなく「依存権の宣言」。
- atoms は作らない（`components/ui/` がリポジトリ全体の atoms）。
- 新規コンポーネントの既定は最下帯（molecules）。上の帯の部品が
  必要になったときに昇格する。
- feature 単位で「フラット or 5 箱」の二択。同一 feature 内の混在は禁止。
- エディタの fileNesting は使わない（削除済み）。
- stories のタイトルに箱名は含めない（現状の明示指定を維持）。

## 順序の制約（ここだけは厳守）

1. **ホワイトリスト型 ast-grep 規則の PoC が go/no-go 条件。**
   「許可プレフィックス以外の import を全禁止」の形で帯規則を書き、
   攻撃的検証で実証済みの穴（`../index` ロンダリング、`.././` 等の
   非正規化パス、barrel 経由の `../organisms`、動的 `import()`）を
   意図的な違反ファイルで検知できることを実証してから先へ進む。
   書けなければ移行を中止してユーザーに報告する。
2. 旧層（`ui/`）と新箱が同一 feature に共存したら fail する検査を、
   ファイル移動より先に入れる。
3. ファイル移動は全 feature 一括（1 PR）。過渡期の 2 流派併存を作らない。

## 同時にやるコンポーネント見直し

- `features/room/ui/room-board-view.tsx`（613 行）の分割。切り出しの
  判定器は「その部分だけ Storybook に載せたいか / 4 状態テストを
  独立に書きたいか」。
- `leave-confirm-dialog` に stories がない規約違反の解消。
- 同じ判定器で切り出す価値のある肥大 view がほかにあれば同様に扱う。
- 箱の割り当ては帯規則に違反しない範囲で自分で判断してよい
  （どの箱でも合法なら好みの問題であり、議論の対象にしない）。

## 品質ゲート

- AGENTS.md の TDD 規約に従う。振る舞いの変更は failing test から。
- 移行後: 全テスト green、`lint` / `lint:boundaries` green、
  Storybook がビルドできる。
- `scripts/dependency-graph.mts` の layerOrder を帯順
  （containers → templates → organisms → molecules → logic）へ。
- 文書の追従: AGENTS.md（2 層規約 → 5 箱規約へ差し替え）、
  docs/feature-internal-structure.md（C′ 決定の記録へ改訂）、
  docs/feature-ui-directory-options.md（決定記録として畳む）、
  ast-grep ルール内のメッセージ文言（「コンポーネントは ui/ へ」等）。
  完了したらこのファイル自体を削除する。

## あえて指定しないこと

各コンポーネントの箱の割り当て、view 分割の粒度と切り出し先、
ホワイトリスト規則の具体的な書き方、作業の分割・並べ方。
設計意図は options doc に全部書いてあるので、実装判断はそこから
推論すること。
