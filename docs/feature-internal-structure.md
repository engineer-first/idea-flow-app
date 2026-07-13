# feature 内部の設計判断 — なぜ Atomic 階層ではなく ui / logic の 2 層か

「Atomic Design を採らない」という判断は、実は独立した 2 つの問いの答えである。

| 問い                             | 選択肢                                              | 採用と文書                                                    |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| 1. リポジトリ全体を何で縦に切るか | 粒度（Atomic ツリー）か、機能（feature）か          | feature 縦割り → [feature-structure.md](feature-structure.md) |
| 2. feature の**中**を何で分けるか | 粒度（molecules / organisms / …）か、役割（ui / logic）か | ui / logic 2 層 → 本ドキュメント                              |

問い 1 で feature 縦割りを選んでも、問い 2 で「feature 内を Atomic 階層に
する」案は成立する（チームで実際に検討された案）。本ドキュメントはその案と
ui / logic 2 層の比較**だけ**を扱う。2026-07 のチーム議論
（スカスカ問題は許容できる、という意見を含む）を反映している。

## TL;DR

1. **feature 内を Atomic にしても `logic/` は消えない。** Atomic は UI
   コンポーネントの分類法で、hook・reducer・Server Action・定数の置き場を
   定義しない。結果は「Atomic 階層 **+** logic/」の 2 重分類になり、
   ファイルを 1 つ作るたびに必要な分類判断が 1 回から 2 回に増える。
2. **molecule / organism の境界は、人間は直感で引けるが機械判定できない。**
   このリポジトリはルールを lint / ast-grep で強制する方針で、コードの多くを
   AI エージェントが書く。直感にしか宿らない規約は CI でもエージェントの
   プロンプトでも強制する手段がなく、黙って腐る。
3. **「ui/ の見通しが悪い」の実体は分類ではなく衛星ファイルの倍率。**
   `features/room/ui` は実装 7 に対し spec / stories / fixture 込みで
   19 ファイル（×2.7）。この倍率はどんな分類法でも変わらないので、
   対策は分類ではなくエディタのファイルネスティングと Storybook で行う。

## 1. 実測: 最大の feature（room）を Atomic 階層に分類し直す

現在の room（実装 14 ファイル）をそのまま Atomic の箱に入れ直すと:

| 箱               | 入るファイル                                                        | 数 |
| ---------------- | ------------------------------------------------------------------- | -- |
| molecules        | force-next-phase-dialog, leave-confirm-dialog                       | 2  |
| organisms        | room-timer                                                          | 1  |
| templates        | room-board-view, room-lobby-view                                    | 2  |
| **（箱がない）** | room-board, room-lobby（container）                                 | 2  |
| logic（結局必要） | room-reducer, use-room-state, use-room-connection, use-leave-room, actions, room-notify, connection-status | 7  |

最大の feature ですらこうなる。読み取れることが 3 つある。

1. **一番大きい箱が logic になる。** Atomic を導入しても、feature 内の
   半分のファイルには何の語彙も与えられない。「Atomic にしたらロジックは
   どこに置くのか」の答えは「結局 logic/ を併設する」以外にない。
   PR #128 以前は、この置き場のなさが `note-color.ts` を molecules/ に
   押し込む形で現れていた。
2. **container に箱がない。** container / view 分離（このリポジトリの必須
   規約）は Atomic の語彙の外にあり、room-board.tsx をどの箱に入れるかは
   毎回の発明になる。
3. **dialog 2 つの分類に事実の根拠がない。** 状態と確認フローを持つ dialog
   を molecule と呼ぶか organism と呼ぶかは判定者の直感次第で、どちらの
   答えにも「中身の事実」による裏付けがない。

## 2. 判定器の性質 — 直感の規約は AI にも CI にも強制できない

「人間の方が直感的に Atomic の大きさが分かる」は正しい。問題は、その直感を
**強制する装置がこのリポジトリに存在しない**ことにある。

- このリポジトリの方針は「静的検査可能なルールはプロンプトではなく linter か
  ast-grep で記述する」。だが「このファイルは molecule である」という前提を
  静的検査で判定できないため、「molecules は organisms を import しない」
  という規則は書けても空振りする。
- コードを書く主体に AI エージェントが含まれる前提では、機械判定できない
  分類は毎 PR の再交渉になる。エージェントは境界基準の文書を読んでも、
  人間同士ですら割れる判定を安定して再現できない。
- 「JSX を返すか」は中身の**事実**なので、人間にもエージェントにも同じ答えを
  返し、ast-grep が fail-closed で強制済み（`logic/` への JSX 混入、規約外
  サブディレクトリからの import は CI で落ちる）。
- 粒度の機械化自体は原理的には可能である（例: 「同一 feature 内の他 UI を
  import する数」を合成度とみなす）。しかしこの判定器は依存を 1 本足すたびに
  所属の箱が変わるため、ファイル移動と import 書き換えの churn を生む。
  分類が変更に追従するのではなく、**変更のたびに分類へ課金される**。

## 3. 「見通しが悪い」の実体と、それを直接殺す装置

`features/room/ui` の 19 ファイルの内訳は「実装 7 / spec 7 / stories 4 /
fixture 1」。見通しの悪さの実体は実装ファイルの数ではなく、この
**衛星ファイル倍率（×2.7）**である。

Atomic の箱に割れば 1 箱あたりのファイル数は減るが、それは「何で割っても」
減る。spec / stories は実装と同居させる規約（変更の局所性のため）なので
倍率そのものは不変で、箱を増やした分のクリック数と分類判断コストだけが
純増する。倍率を直接殺す装置はこの 2 つ:

- **エディタのファイルネスティング**（`.vscode/settings.json` で設定済み）。
  エクスプローラー上で spec / stories / fixture が実装ファイルの配下に
  畳まれ、`room/ui` は実装 7 件だけが並んで見える。ただし効くのは
  VS Code の画面だけで、GitHub の Web 表示や他エディタでは 19 ファイルの
  まま。IDE 非依存の代替（コンポーネントごとのディレクトリ）との比較は
  [feature-ui-directory-options.md](feature-ui-directory-options.md)（未決・
  話し合い用）へ。
- **Storybook**。部品の「大きさ」はディレクトリ名の解読ではなく、実物の
  レンダリングで見る（全 UI に stories 必須の規約はこのため）。

それでも実装ファイル自体が育ったときの処方箋は、粒度の箱ではなく
**feature 切り出し**（52 ファイル時代の room から notes を切り出した前例）。
切り出しのタイミングは主観ではなく、Storybook の `Dependencies/*`
実測依存図で「ui/ 内で相互にしか import されないクラスタ」が見えたとき、
と機械的に判断できる。今後のホワイトボード UI 化・ツールバー分割も
この手で受ける。

## 4. スカスカ問題の位置づけ

チーム議論では「箱あたり 1〜2 個でも許容できる」という意見があった。
これは妥当な感覚で、スカスカは決定打ではなく数あるコストの 1 つに
位置づけ直す。ui / logic 2 層を採る決定打はスカスカではなく、
§1（分類が 2 重になる）と §2（境界を機械検査できない）である。

## 5. 再検討のトリガー

次の両方が成立したら、feature 内 Atomic 階層を再検討する価値がある。

- 1 つの feature の `ui/` の実装ファイルが、feature 切り出しでは分けられない
  まま 15 を超える（現状最大は room の 7）。
- molecule / organism の境界に、churn を生まない機械判定器が見つかる。

片方だけなら答えは変わらない: 前者だけなら切り出し漏れを疑い、
後者だけなら分ける動機がない。

## 6. 補足 Q&A（2026-07-13 の議論から）

### Q. container / view 分離とは何か

`room-board.tsx`（container）と `room-board-view.tsx`（view）のペアが実例。
view は「props でデータを受け取って描き、起きたことは callback で報告する」
だけの部品で、サーバーにも WebSocket にも触らない。container は hook
（`use-room-connection`、`use-room-notes` 等）を束ねて view の props に
流し込む配線係。判定器は「**Storybook に単体で載せられるか**」——view は
偽の props だけで描画できるから stories と 4 状態テストが書ける。分けないと
描画と通信が癒着し、Storybook に載せるには通信ごとモックする羽目になる。

### Q. logic/ は Next.js を使う限り不可避なのか

不可避だが、主語は Next.js ではなく UI 開発全般。logic/ の中身のうち
Next.js 固有なのは Server Action（`actions.ts`）だけで、reducer・純関数・
定数はただの TypeScript、hook は React を使う限り生まれる。フレームワークを
替えても logic の大半は残る。Atomic がこの層に語彙を持たないのは、Atomic が
「UI コンポーネントの分類法」だから。

### Q. logic を分けずに Atomic だけにしたらどうなるか

このリポジトリの過去に実例がある（`note-color.ts` が molecules/ に押し
込まれていた）。ロジックが tsx に埋まると、2 つ目の利用者が現れたとき
「コンポーネントごと import する」か「コピーする」かの二択になり、重複と
散在が始まる。テストも純関数の入出力テストから DOM レンダリング必須の
テストに劣化する（logic/ への JSX 禁止ルールの動機そのもの）。

### Q. コンポーネントの切り出し方・.ts への分離の仕方は別途規約が要るか

大部分は決定済みで AGENTS.md に記載がある（container / view 分離必須、
view は props in・callback out、container 肥大は関心ごとの `use-*` に分割、
JSX を返さないものは logic/ = ast-grep 強制、全 UI に stories 必須）。
未決なのは「肥大した view からいつ子コンポーネントを切り出すか」だけで、
これは行数の閾値ではなく既存の判定器の流用で足りる:
「その部分だけ Storybook に載せたい・4 状態テストを独立に書きたく
なったら切り出す」。

### Q. 衛星ファイルの見通しは、コンポーネントごとのディレクトリでも解決できるのでは

できる。しかも判定器が機械的（ディレクトリ名 = コンポーネントのステム）で、
Atomic と違い主観判断を持ち込まない。IDE 非依存という点でファイル
ネスティングより強い。ただし ast-grep の境界ルールが「feature 内は深さ 2
まで」を前提に書かれているため改修が要る。選択肢の比較と論点は
[feature-ui-directory-options.md](feature-ui-directory-options.md) へ。

## 参考

- [feature-structure.md](feature-structure.md) — 問い 1（feature 縦割り）の
  判断。PR #128 以前に全体 Atomic ツリーで実際に起きたことの記録を含む
- `rules/ast-grep/feature-dependencies-one-way.yml` — ui / logic 境界の
  機械検査（logic/ への JSX 混入、規約外サブディレクトリの fail-closed）
- `scripts/dependency-graph.mts` — 切り出し判断に使う実測依存図の生成
