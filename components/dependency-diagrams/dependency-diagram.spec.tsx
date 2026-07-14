// DependencyDiagram（container）の状態遷移テスト。.mmd の fetch と mermaid の
// レンダリングをモックし、loading → success / error を検証する。
// empty 状態は存在しない: 生成側（scripts/build-dependency-diagrams.mts）が
// flowchart ヘッダ付きテキストを必ず出力するため、「空のデータ」が届く経路がない。
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DependencyDiagram } from "./dependency-diagram";

const mermaidRender = vi.fn();
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => mermaidRender(...args),
  },
}));

function stubFetch(implementation: () => Promise<Response>): void {
  vi.stubGlobal("fetch", vi.fn(implementation));
}

describe("DependencyDiagram", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mermaidRender.mockReset();
  });

  it("読み込みが完了するまで loading を表示する", () => {
    stubFetch(() => new Promise<Response>(() => {}));
    render(
      <DependencyDiagram
        title="room"
        description="d"
        src="/x/feature-room.mmd"
      />,
    );
    expect(screen.getByText("図を読み込み中…")).toBeInTheDocument();
  });

  it("取得した mermaid テキストを SVG として描画する", async () => {
    stubFetch(async () => new Response("flowchart LR", { status: 200 }));
    mermaidRender.mockResolvedValue({
      svg: '<svg role="img"><title>graph</title></svg>',
    });
    render(
      <DependencyDiagram
        title="room"
        description="d"
        src="/x/feature-room.mmd"
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("dependency-diagram-svg")).toBeInTheDocument();
    });
    expect(mermaidRender).toHaveBeenCalledWith(
      expect.any(String),
      "flowchart LR",
    );
    expect(
      screen.getByTestId("dependency-diagram-svg").querySelector("svg"),
    ).not.toBeNull();
  });

  it("fetch が失敗したらエラーを表示する", async () => {
    stubFetch(async () => new Response("not found", { status: 404 }));
    render(
      <DependencyDiagram title="room" description="d" src="/x/missing.mmd" />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("HTTP 404");
    });
  });

  it("mermaid のレンダリング失敗もエラーとして表示する", async () => {
    stubFetch(async () => new Response("broken text", { status: 200 }));
    mermaidRender.mockRejectedValue(new Error("Parse error"));
    render(
      <DependencyDiagram
        title="room"
        description="d"
        src="/x/feature-room.mmd"
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Parse error");
    });
  });
});
