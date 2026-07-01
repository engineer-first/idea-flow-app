---
name: pbi-demogoal
description: Create idea-flow-app PBI and consolidated DemoGoal GitHub Issues only. Use when Codex needs to add one product backlog item and one PBI-linked demo goal issue to engineer-first/idea-flow-app and place them in the GitHub Project with the correct Issue Type, milestone, and Status board column. Do not use for sprint task or bug issue creation.
---

# PBI DemoGoal

Use this skill to create one PBI issue and one consolidated DemoGoal issue for `engineer-first/idea-flow-app`.

Do not use this skill for sprint task or bug issues. Sprint tasks and bugs are usually created through the GitHub GUI from their issue templates; the Project auto-add workflow imports `Task` and `Bug` issue types and the default workflow places them in `Todo`.

## Workflow

1. Inspect the current repository and existing issues before choosing IDs.
   - Use `gh issue list --state all --json number,title,issueType,projectItems`.
   - Keep the existing naming pattern: `PBI-XX` and `DEMO-XX`.
2. Turn the user's request into one JSON spec.
3. Run `scripts/create_planning_issues.py --dry-run <spec.json>` and review the rendered issue titles and bodies.
4. Run `scripts/create_planning_issues.py <spec.json>` to create the issues.
5. Verify both created issues have:
   - Issue Type: `PBI` or `DemoGoal`
   - Project: `idea-flow-app`
   - Status: `PBI` for PBI, `Demo Goal` for demo goals
6. Report the created issue URLs and the Project field verification.

## Spec Format

Create a temporary JSON file outside the skill folder, for example under `/tmp`.

```json
{
  "repo": "engineer-first/idea-flow-app",
  "project_owner": "engineer-first",
  "project_number": 3,
  "milestone": "Sprint 2",
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
      "checks": ["GitHubリポジトリにアプリケーションのソースコードが存在する"]
    }
  ]
}
```

Notes:

- Omit `milestone` only when the user explicitly wants no sprint milestone.
- Put the human-readable title without the ID in `pbi.title`; the script prefixes `PBI-XX`.
- The demo issue title is derived from the PBI: `DEMO-<PBI番号> <PBIタイトル>`.
- Put each reviewable outcome inside `demo_goals`; the script renders all of them into one DemoGoal issue.
- Use `memo` for implementation-task candidates, unresolved notes, or whiteboard context.

## Script

Run from the repository root:

```bash
python3 .codex/skills/pbi-demogoal/scripts/create_planning_issues.py --dry-run /tmp/idea-flow-spec.json
python3 .codex/skills/pbi-demogoal/scripts/create_planning_issues.py /tmp/idea-flow-spec.json
```

The script uses Issue Type instead of labels. Ensure `gh auth status` has `repo` and `project` scopes.
