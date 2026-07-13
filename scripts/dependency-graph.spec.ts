// features/ の import 依存を mermaid flowchart に変換するロジックのテスト。
// 実ファイルシステムには依存させず、import 抽出・実装ファイル判定・
// 図のレンダリングをそれぞれ検証する。出力は Chromatic の差分検出を安定させる
// ため決定的（ソート済み・全文一致で固定）であることも仕様に含める。
import { describe, expect, it } from "vitest";
import {
  buildFeatureDiagram,
  buildOverviewDiagram,
  extractImportPaths,
  isImplementationFile,
} from "./dependency-graph.mts";

describe("extractImportPaths", () => {
  it("単一行の import from を抽出する", () => {
    expect(
      extractImportPaths('import { NoteCard } from "./note-card";\n'),
    ).toEqual(["./note-card"]);
  });

  it("import type / 複数行 import / export from も抽出する", () => {
    const source = [
      'import type { Note } from "../logic/notes-reducer";',
      "import {",
      "  BOARD_HEIGHT,",
      "  BOARD_WIDTH,",
      '} from "@/contracts/board";',
      'export { StickyNote } from "./ui/sticky-note";',
    ].join("\n");
    expect(extractImportPaths(source)).toEqual([
      "../logic/notes-reducer",
      "@/contracts/board",
      "./ui/sticky-note",
    ]);
  });

  it("副作用 import（from なし）も抽出する", () => {
    expect(extractImportPaths('import "./globals.css";\n')).toEqual([
      "./globals.css",
    ]);
  });

  it("文字列リテラルやコメント内の from は拾わない", () => {
    const source = [
      '// import { fake } from "./comment";',
      "const s = 'from \"./string\"';",
    ].join("\n");
    expect(extractImportPaths(source)).toEqual([]);
  });
});

describe("isImplementationFile", () => {
  it.each([
    ["ui/note-card.tsx", true],
    ["logic/notes-reducer.ts", true],
    ["index.ts", true],
    ["ui/note-card.spec.tsx", false],
    ["ui/note-card.stories.tsx", false],
    ["ui/room-timer.fixture.ts", false],
  ])("%s -> %s", (path, expected) => {
    expect(isImplementationFile(path)).toBe(expected);
  });
});

describe("buildFeatureDiagram", () => {
  it("2 層 feature を subgraph 付きで決定的にレンダリングする", () => {
    const diagram = buildFeatureDiagram({
      name: "notes",
      files: [
        {
          path: "index.ts",
          source: 'export { NoteCard } from "./ui/note-card";\n',
        },
        {
          path: "ui/note-card.tsx",
          source: [
            'import { DotVoteControls } from "@/features/dot-vote";',
            'import { NOTE_CONTENT_MAX_LENGTH } from "@/contracts/room-protocol";',
            'import type { Note } from "../logic/notes-reducer";',
            'import { StickyNote } from "./sticky-note";',
          ].join("\n"),
        },
        { path: "ui/sticky-note.tsx", source: "" },
        { path: "logic/notes-reducer.ts", source: "" },
      ],
    });
    expect(diagram).toBe(
      [
        "flowchart LR",
        '  index["index.ts"]',
        '  subgraph ui["ui/"]',
        '    ui_note_card["note-card"]',
        '    ui_sticky_note["sticky-note"]',
        "  end",
        '  subgraph logic["logic/"]',
        '    logic_notes_reducer["notes-reducer"]',
        "  end",
        '  feat_dot_vote{{"dot-vote"}}',
        "  index --> ui_note_card",
        "  ui_note_card --> feat_dot_vote",
        "  ui_note_card --> logic_notes_reducer",
        "  ui_note_card --> ui_sticky_note",
        "",
      ].join("\n"),
    );
  });

  it("フラット feature は subgraph なしでレンダリングする", () => {
    const diagram = buildFeatureDiagram({
      name: "dot-vote",
      files: [
        {
          path: "index.ts",
          source: 'export { DotVoteButton } from "./dot-vote-button";\n',
        },
        { path: "dot-vote-button.tsx", source: "" },
      ],
    });
    expect(diagram).toBe(
      [
        "flowchart LR",
        '  dot_vote_button["dot-vote-button"]',
        '  index["index.ts"]',
        "  index --> dot_vote_button",
        "",
      ].join("\n"),
    );
  });

  it("spec / stories / fixture はノードにもエッジにも含めない", () => {
    const diagram = buildFeatureDiagram({
      name: "notes",
      files: [
        { path: "ui/note-card.tsx", source: "" },
        {
          path: "ui/note-card.spec.tsx",
          source: 'import { NoteCard } from "./note-card";',
        },
      ],
    });
    expect(diagram).not.toContain("spec");
    expect(diagram).toContain('ui_note_card["note-card"]');
  });

  it("解決できない相対 import はエッジを作らない", () => {
    const diagram = buildFeatureDiagram({
      name: "notes",
      files: [
        {
          path: "ui/note-card.tsx",
          source: 'import { Gone } from "./deleted-file";',
        },
      ],
    });
    expect(diagram).not.toContain("-->");
  });

  it("contracts / lib / components への import は図に含めない", () => {
    const diagram = buildFeatureDiagram({
      name: "invite",
      files: [
        {
          path: "ui/copy-invite-button.tsx",
          source: [
            'import { Button } from "@/components/ui/button";',
            'import { notify } from "@/lib/notify";',
            'import { InviteCode } from "@/contracts/invite";',
          ].join("\n"),
        },
      ],
    });
    expect(diagram).not.toContain("-->");
    expect(diagram).not.toContain("contracts");
  });
});

describe("buildOverviewDiagram", () => {
  it("app と feature 間の依存を集約してレンダリングする", () => {
    const diagram = buildOverviewDiagram(
      [
        {
          name: "room",
          files: [
            {
              path: "ui/room-board.tsx",
              source: [
                'import { useRoomNotes } from "@/features/notes";',
                'import { NoteCard } from "@/features/notes";',
              ].join("\n"),
            },
          ],
        },
        {
          name: "notes",
          files: [
            {
              path: "ui/note-card.tsx",
              source: 'import { DotVoteControls } from "@/features/dot-vote";',
            },
          ],
        },
        { name: "dot-vote", files: [] },
      ],
      [
        {
          path: "app/rooms/[id]/page.tsx",
          source: 'import { RoomBoard } from "@/features/room";',
        },
      ],
    );
    expect(diagram).toBe(
      [
        "flowchart LR",
        '  app["app/"]',
        '  dot_vote["dot-vote"]',
        '  notes["notes"]',
        '  room["room"]',
        "  app --> room",
        "  notes --> dot_vote",
        "  room --> notes",
        "",
      ].join("\n"),
    );
  });
});
