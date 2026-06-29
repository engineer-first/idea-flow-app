# docs

このディレクトリは、学校スクラム開発で使うホワイトボード、GitHub Issues / Projects、AI向け文脈の参照先を迷わず確認するための場所です。

PBI、デモゴール、実装タスク、進捗状態の正本はGitHub Issues / Projectsです。物理ホワイトボードはチームで話すための場として使い、MarkdownにPBI本文やデモゴール本文を二重管理しません。

## ドキュメント一覧

| ファイル                                                       | 役割                                            |
| -------------------------------------------------------------- | ----------------------------------------------- |
| [whiteboard-github-projects.md](whiteboard-github-projects.md) | 物理ホワイトボードとGitHub Projectsの連携ルール |
| [sprints.md](sprints.md)                                       | スプリント期間と管理理由                        |
| [prd.md](prd.md)                                               | プロダクトの目的、ユーザー、成功条件            |
| [screen-flow.md](screen-flow.md)                               | 画面フローを書くための空ファイル                |

## 正本

| 対象           | 正本                               |
| -------------- | ---------------------------------- |
| PBI            | `type:PBI`、`label:pbi` のGitHub Issue |
| デモゴール     | `type:DemoGoal`、`label:demo-goal` のGitHub Issue |
| 実装タスク     | GitHub Issue                       |
| 進捗状態       | GitHub Projectの`Board Column`     |
| スプリント対象 | `sprint-1`から`sprint-4`のGitHubラベル |
| ホワイトボード | チームで話すための短い見出し       |

PBI、デモゴール、スプリントタスク、バグを作るときは、GitHub Issue作成画面のテンプレートを使います。分類は`title`、`labels`、`type`、`assignees`で揃えます。

現在のテンプレートはSprint 2期間用に`sprint-2`ラベルを付けます。次のスプリントに入るときは、テンプレート内の`sprint-2`を次のスプリントラベルに変更します。

## よく使うリンク

| 用途                                    | URL                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Project                          | [idea-flow-app Project](https://github.com/orgs/engineer-first/projects/3)                                                                                  |
| openの実装タスクだけを見る              | [open task issues](https://github.com/engineer-first/idea-flow-app/issues?q=is%3Aissue%20state%3Aopen%20label%3Atask)                                       |
| PBIとデモゴールを除いたopen Issueを見る | [open issues without pbi/demo-goal](https://github.com/engineer-first/idea-flow-app/issues?q=is%3Aissue%20state%3Aopen%20-label%3Apbi%20-label%3Ademo-goal) |

標準のIssues一覧にはPBIやデモゴールも表示されます。実装中の作業を見るときは、上の`openの実装タスクだけを見る`リンクを使います。

## スプリント期間

スプリント期間は[sprints.md](sprints.md)にまとめます。

## ホワイトボードの書き方

ホワイトボードには短い表記だけを書きます。

```text
PBI-08 ログイン体験
DE-08-01 Googleログインボタン表示
#12 Googleログインボタン
```

長い説明、受け入れ条件、技術メモはIssue本文に書きます。

`ToDo`、`Doing`、`Wait`、`Done`は、スプリントタスクの付箋を動かす場所です。独立した「スプリントタスク」列は作りません。

## ホワイトボード写真

ホワイトボード写真は、原則としてリポジトリでは管理しません。

IssueとProjectを正にして、人がIssue状態に合わせて物理付箋を動かす運用なら、写真を毎日残す必要は薄いです。証跡として残したい日だけ、Google Driveなどリポジトリ外に保存します。

## スプリント識別

スプリント対象かどうかは、GitHubラベルで管理します。

Projectフィールドの手動設定を減らすため、`sprint-1`、`sprint-2`、`sprint-3`、`sprint-4`ラベルを使います。

## AIに依頼しやすい問い

- `GitHub ProjectとPBI Issue、デモゴールIssueを見て、レビュー前のリスクを整理してください`
- `PBI IssueとデモゴールIssueを見て、まだIssue化されていないタスクを洗い出してください`
- `WaitになっているIssueを見て、今日確認すべきことを短くまとめてください`
- `DoneのIssueから、スプリントレビューで話す順番を提案してください`
