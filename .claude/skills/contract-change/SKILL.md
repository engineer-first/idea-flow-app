---
name: contract-change
description: contracts/（zod 境界スキーマ）の変更を、否定系テスト先行のコントラクトファースト手順で進める。WS プロトコル・REST・セッションの形を変えるときに使う
argument-hint: <変更内容>
---

# コントラクトファースト変更

境界（WS プロトコル・REST・セッション・ボード定数）の形を変えるときの手順。
`contracts/` が境界の真実であり、実装層は再生成可能に保つ。実装から先に
変えると、境界の形が実装の都合に引きずられ、クライアント・サーバー間の
不整合がテストではなく実行時に見つかることになる。

## 手順

1. **contracts/ を先に変更する**
   - 対象: `contracts/room-protocol.ts` / `contracts/api.ts` /
     `contracts/session.ts` / `contracts/board.ts`
   - 上限（文字数・座標範囲・要素数）は contracts の定数として定義する
   - クライアントに書き換えさせたくないフィールド（authorId / roomId など）は
     メッセージに含めない。認可チェックではなく形で塞ぐ
2. **否定系テストを先に書く**
   - 非メンバー・非 author・未認証が「できない」ことを `workers/*.spec.ts` に
     先に書き、red を確認する
   - 可視性に関わる変更なら `workers/visibility.spec.ts` のテーブルに行を追加する
3. **サーバー実装を追従させる**
   - `workers/room/`（WS プロトコル）/ `workers/api-worker.ts`（REST）。
     可視性の判定は `visibleTo()` に一点集約し、迂回する送信経路を作らない
4. **クライアント実装を追従させる**
   - `lib/room-client/` と `app/`。UI の状態遷移が変わるなら spec と stories も更新する
5. **green を確認する**
   - `npm run test` と `npm run test:workers` の両方
6. **PR 前に認可レビューを通す**
   - `authz-security-reviewer` エージェントでレビューする

## チェックリスト

- スキーマ名（型・zod）は PascalCase
- 入力の上限が contracts の定数で定義されている
- 否定系テストが実装より先に red になった
- クライアント・サーバーの両方が同じ contracts を import している
  （形のコピーを作っていない）
