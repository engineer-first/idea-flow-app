---
name: pbi-demogoal
description: idea-flow-app の PBI issue と、それに紐づく DemoGoal issue のみを作成する。プロダクトバックログアイテム（PBI）と、それに対応するデモゴール issue を engineer-first/idea-flow-app に追加し、正しい Issue Type・milestone・Status で GitHub Project に配置したいときに使う。スプリントタスクやバグ issue の作成には使わない。
---

# PBI DemoGoal

`engineer-first/idea-flow-app` に PBI issue 1件と、それに紐づく DemoGoal issue 1件を作成するスキル。

スプリントタスクやバグ issue にはこのスキルを使わない。スプリントタスク・バグは通常 GitHub の GUI から issue テンプレートで作成され、Project の自動追加ワークフローが `Task` / `Bug` の Issue Type を取り込み、デフォルトのワークフローで `Todo` に配置する。

## 手順

1. ID を決める前に、リポジトリの現状と既存 issue を確認する。
   - `gh issue list --state all --json number,title,issueType,projectItems` を使う。
   - 既存の命名パターン（`PBI-XX` / `DEMO-XX`）を踏襲する。
2. ユーザーの依頼を1つの JSON spec に変換する。
3. `create_planning_issues.py --dry-run <spec.json>` を実行し、生成される issue タイトル・本文を確認する。
4. `create_planning_issues.py <spec.json>` を実行して issue を作成する。
5. 作成した2件の issue が以下を満たすことを確認する:
   - Issue Type: `PBI` または `DemoGoal`
   - Project: `idea-flow-app`
   - Status: PBI は `PBI`、デモゴールは `Demo Goal`
6. 作成した issue の URL と、Project フィールドの確認結果を報告する。

## Spec のフォーマット

一時的な JSON ファイルをスキルフォルダの外（例: `/tmp` 配下）に作成する。

```json
{
  "repo": "engineer-first/idea-flow-app",
  "project_owner": "engineer-first",
  "project_number": 3,
  "milestone": "Sprint 2",
  "demo_overview": "開発環境が統一され、誰でも同じ手順でアプリを起動できる状態をデモする。",
  "pbi": {
    "id": "PBI-01",
    "title": "開発環境を統一する",
    "story": "開発者としてチーム全員が同じ環境で開発できるようにしたい。開発環境の違いによる問題を減らしたいからだ。",
    "acceptance": [
      "GitHubリポジトリでソースコードが管理されている",
      "READMEで環境構築手順と起動方法を確認できる"
    ],
    "memo": ["既存の実装タスク候補: #7 [Task] 環境構築"]
  },
  "demo_goals": [
    {
      "title": "GitHubリポジトリでソースコードが管理されている",
      "goal": "GitHubリポジトリを開くと、アプリケーションのソースコードが管理されていることを確認できる。",
      "checks": ["GitHubリポジトリにアプリケーションのソースコードが存在する"],
      "risks": ["READMEの手順が古いと再現できない"]
    }
  ],
  "not_doing": ["CI環境の統一はスコープ外"]
}
```

補足:

- `milestone` を省略するのは、ユーザーが明示的にスプリント milestone なしを望む場合のみ。
- `pbi.title` には ID を含まない人間可読なタイトルだけを入れる。ID（`PBI-XX`）はスクリプト側が接頭辞として付与する。
- デモ issue のタイトルは PBI から導出される: `DEMO-<PBI番号> <PBIタイトル>`。
- レビュー可能な成果はそれぞれ `demo_goals` に入れる。スクリプトがそれらをすべて1つの DemoGoal issue にまとめてレンダリングする。
- `memo` は実装タスク候補・未解決事項・ホワイトボード上のメモなどに使う。
- `demo_overview` を省略すると既定文（`<PBIタイトル> として、以下の状態をスプリントレビューでデモする。`）にフォールバックする。デモの見せ方を変えたいときだけ指定する。
- `not_doing` は明示的にスコープ外とする項目に使う。全デモゴールの後に `## やらないこと` セクションとしてレンダリングされる。
- `demo_goals` 内の `risks` はそのゴール固有の注意点に使う。該当ゴールの下にだけ `リスク:` リストとしてレンダリングされる。

## スクリプト

このスキルと Codex スキル（`.codex/skills/pbi-demogoal/`）は同じスクリプトを共有しているため、修正は1箇所で済む。リポジトリのルートから実行する:

```bash
python3 .agents/skills/pbi-demogoal/scripts/create_planning_issues.py --dry-run /tmp/idea-flow-spec.json
python3 .agents/skills/pbi-demogoal/scripts/create_planning_issues.py /tmp/idea-flow-spec.json
```

このスクリプトはラベルではなく Issue Type を使う。`gh auth status` が `repo` と `project` の scope を持っていることを確認しておく。
