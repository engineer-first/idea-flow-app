# tldraw × Supabase Realtime Broadcast 同期PoC

## 背景・目的

issue #22(付箋のCRUD)の本実装に入る前に、「tldraw syncのようなリアルタイム共同編集を、将来Supabaseと組み合わせて実現できそうか」を見極めるための技術検証(PoC)を`feature/22_update`ブランチで行った。

このブランチのゴールは issue #22 の本実装そのものではない。付箋UIはtldraw標準の`NoteShapeUtil`をそのまま使い、専用の入力フォームは作らない。同期方式も`@tldraw/sync`公式プロトコル(Durable Objects前提)ではなく、`editor.store.listen()`で差分を取得しSupabase Realtime **Broadcast**経由でDIY同期する、という最小構成で検証した。

## 検証したかったこと

- tldrawのストアAPI(`store.listen` / `store.mergeRemoteChanges` / `store.put` / `store.remove`)だけで、外部の同期基盤(ここではSupabase Realtime Broadcast)にレコード差分を流し込めるか。
- Supabase Realtime BroadcastがDIY同期のトランスポートとして実用的なレイテンシ・扱いやすさを持つか。
- Next.js 16(App Router)構成の中で、tldrawのような「ブラウザ専用・SSR不可」なライブラリをどう組み込むのが自然か。

## 試した構成

- 新規ルート`/whiteboard`(ログイン不要、認証ガードなし)。
- `app/whiteboard/page.tsx`(Server Component、`metadata`のみexport) → `whiteboard-canvas-loader.tsx`(`'use client'`、`next/dynamic(..., { ssr: false })`ラッパー) → `whiteboard-canvas.tsx`(`'use client'`、tldraw本体 + 同期ロジック)の3ファイル構成。
- Next.js 16では`ssr:false`はClient Componentからしか呼べず、`metadata`はServer Componentからしかexportできないため、この3分割で両立させた。
- 同期チャンネルは固定文字列`"whiteboard-poc"`、イベント名は固定文字列`"store-update"`。ルームIDのenv化や動的化は行っていない。
- DB永続化なし・認証なし・初期スナップショット配信なしの、Broadcastのみで完結するその場限りの同期。

## 実装のポイント

### エコー防止(3重の防御)

自分が送信した変更が自分自身に返ってきて無限ループ・二重適用にならないよう、3段構えにした。

1. **送信側フィルタ**: `store.listen(callback, { source: "user", scope: "document" })`で購読する。`source: "user"`によりリモート由来の変更(`mergeRemoteChanges`内で`source: "remote"`とタグ付けされる)はコールバックを発火させない。`scope: "document"`によりカメラ位置などsession/presenceスコープの変更を無視し、付箋を含むdocumentスコープのみを対象にする。
2. **受信側の適用経路**: 受信したレコードは必ず`store.mergeRemoteChanges(() => { store.put(...); store.remove(...); })`の中で適用する。これによりtldraw内部でも「リモート由来」として扱われ、(1)のフィルタと整合する。
3. **Broadcastの`self`設定**: `supabase.channel("whiteboard-poc")`は`broadcast.self`を明示せず既定の`false`のままにした。自分の送信メッセージが自分の購読に返ってこない。

この3つは役割が異なる独立した防御であり、どれか1つでも欠けると自分の変更が自分に返ってきて余計な`mergeRemoteChanges`呼び出しが走る(実害は小さいが無駄なネットワーク/再描画が発生する)。

### ペイロード設計

`store.listen`のコールバックが渡す`HistoryEntry`の`changes: RecordsDiff`から、以下の形に変換してBroadcastで送信した。

```ts
type StoreUpdatePayload = {
  added: TLRecord[];
  updated: TLRecord[]; // [from, to] の to だけを取り出す
  removed: string[];   // IDの配列
};
```

- `added`/`updated`/`removed`が3つとも空なら送信しない(無駄な空メッセージを飛ばさない)。
- 受信側で`store.remove()`にIDを渡す際、tldrawの`IdOf<R>`はブランド付き文字列型のため、Broadcast経由で受け取った素の`string[]`をそのまま渡すことができず、型アサーションが必要だった。ネットワーク越しにやり取りする時点で型のブランドは失われるため、これは同期系DIY実装につきものの制約と言える。

### `useEffect`の構造

1つの`useEffect`(依存配列`[store, supabase]`)内で、チャンネル生成 → `broadcast`イベント購読登録 → `channel.subscribe()` → `store.listen()`購読、の順にセットアップし、cleanupで`unlisten()`と`supabase.removeChannel(channel)`を呼ぶ構成にした。`channel.unsubscribe()`ではなく`supabase.removeChannel(channel)`を使うのは、Supabaseクライアント内部のチャンネル管理から確実に除去するため。

`store`と`supabase`はどちらも`useState`の初期化関数で1回だけ生成し、参照を安定させている。これによりBiomeのexhaustive-depsルールを満たしつつ、Reactの再レンダリングごとにチャンネルを張り直すような無駄も避けられる。

## 分かったこと・手応え

- ビルド面: `npm run lint` / `npm run typecheck` / `npm run build`はいずれも成功した。`/whiteboard`は静的ルート(`○`)として生成され、tldrawのようなクライアント専用ライブラリでも`next/dynamic(ssr:false)`ラッパー越しなら静的プリレンダーの枠組みを壊さずに共存できることを確認した。
- `curl`でのHTTPレベル確認では、`/whiteboard`が200を返しtldrawのDOM(コンテナ要素)が含まれることを確認した。
- **重要な限界**: このPoCでは2ブラウザタブでの実際の同期挙動(付箋の作成・移動・編集・削除がリアルタイムに反映されるか)を、この検証を行ったエージェント自身では確認できていない。作業環境にブラウザ操作ツールが用意されておらず、インタラクティブな手動確認が実行不可能だったため。実装はtldraw/Supabaseの型定義とAPIドキュメントに基づいて組んだが、**実際の2タブ同期確認は開発者による手動テストが必須**である(本ファイル冒頭の検証方法の手順3〜10を参照)。
- ローカル環境では`localhost:3000`が別プロジェクト(Rubyアプリ)に占有されていたため、動作確認時は`next dev`が出力するLAN側アドレス(例: `http://192.168.100.62:3000/whiteboard`)を使う必要があった。これはこのPoC自体の問題ではなく開発マシンのポート競合によるものだが、手動確認時にハマりやすい点として記録しておく。

## 既知の制限事項

- **初期スナップショット配信なし**: 後から開いたタブには、それまでに作成された付箋が反映されない。Broadcastは購読開始後に流れてきたメッセージしか受け取れず、DB永続化もないため「今の状態」を取得する手段がない。
- **永続化なし**: サーバー再起動やSupabase再起動、あるいは全タブを閉じると、それまでの付箋データは失われる。
- **競合解決なし**: 複数タブが同時に同じ付箋を編集した場合の一貫性は保証されない。単純に「最後に届いたBroadcastで上書き」という動作になる。
- **プレゼンスなし**: 他ユーザーのカーソル位置や選択状態は同期していない(`scope: "document"`のみを対象にしているため、意図的に対象外にしている)。
- **RLS未使用**: 認証を要求しておらず、Supabase Realtime BroadcastのRLS(Realtime Authorization)も設定していない。誰でもチャンネルに参加でき、送受信できる。
- **レート制限リスク**: `store.listen`のコールバックは細かい操作(ドラッグ中の連続移動など)のたびに発火しうるため、高頻度な編集ではSupabase Realtimeのレート制限に抵触する可能性がある。今回はスロットリング/デバウンスを実装していない。

## tldraw sync(公式)との違い

`@tldraw/sync`はDurable Objects(Cloudflare Workers)を前提としたサーバー権威型のアーキテクチャで、以下の点が今回のDIY実装と本質的に異なる。

- **権威の所在**: 公式syncはサーバー(Durable Object)がドキュメントの正本を持ち、クライアントはサーバーと差分をやり取りする。今回のPoCはサーバー側に状態を一切持たず、Broadcastは単なるメッセージの中継に過ぎない。
- **接続時の同期**: 公式syncはクライアント接続時にサーバーから現在の全スナップショットを受け取れるため、後から参加しても最新状態が見える。今回のPoCにはこれがなく、「既知の制限事項」に記載の通り後発タブに反映されない。
- **競合解決**: 公式syncはサーバー側で操作の順序を確定させ、一貫した状態収束を保証する仕組みを持つ。今回のDIY実装にはそのような保証がない。
- **永続化**: 公式syncはDurable Objectのストレージにドキュメントを永続化する。今回はDB永続化なしのその場限りの同期。

つまり今回のPoCは「tldrawのstore差分をトランスポート層(Broadcast)に流す」という最小限の配線が成立するかを確かめたものであり、公式syncが提供するサーバー権威性・永続化・接続時同期・競合解決は代替していない。

## 今後(issue #22本実装・本格リアルタイム化)への示唆

- issue #22の本実装(付箋のCRUD)では、DB永続化・RLSによるアクセス制御・認証必須という要件が前提になるため、今回のBroadcastのみの構成をそのまま拡張するのではなく、Supabase Postgres Changes(テーブル変更のリアルタイム配信)や、テーブルへの読み書きAPIと組み合わせる設計が必要になる。
- 「本格的なリアルタイム共同編集」まで踏み込む場合は、今回のDIY Broadcast方式では競合解決・接続時スナップショット・プレゼンスをすべて自前実装することになり、コストは`@tldraw/sync`公式プロトコル(または類似のCRDT/OTベースの仕組み)を採用する場合と大きく変わらない可能性がある。issue #22で「リアルタイム共同編集」まで求めるかどうかは、要件定義の段階で改めてスコープを確認したほうがよい。
- 一方、issue #22が「単一ユーザーの付箋CRUD」で完結するならば、今回検証したリアルタイム同期そのものは不要で、通常のSupabaseテーブルCRUD + 必要に応じたPostgres Changesの購読で十分と考えられる。
- エコー防止の3重防御(`source`フィルタ / `mergeRemoteChanges` / `broadcast.self: false`)のパターンは、今回の検証目的を超えて、他のリアルタイム機能を実装する際にも再利用できる考え方として記録しておく価値がある。

## 参考リンク

- [tldraw公式ドキュメント](https://tldraw.dev/)
- [tldraw store API(`listen` / `mergeRemoteChanges`)](https://tldraw.dev/reference/store/Store)
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [@tldraw/sync](https://tldraw.dev/docs/sync)
