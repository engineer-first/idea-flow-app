// DependencyDiagramView の stories 用サンプル SVG。実際の mermaid 出力の
// 代わりに使う最小の図（container を通さず view 単体を表示するため）。
export const SAMPLE_DIAGRAM_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="80" role="img">',
  '<rect x="8" y="24" width="120" height="32" rx="6" fill="#dbeafe" stroke="#1d4ed8"/>',
  '<text x="68" y="44" text-anchor="middle" font-size="12">note-card</text>',
  '<line x1="128" y1="40" x2="220" y2="40" stroke="#334155" marker-end="url(#a)"/>',
  '<defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#334155"/></marker></defs>',
  '<rect x="224" y="24" width="120" height="32" rx="6" fill="#dcfce7" stroke="#15803d"/>',
  '<text x="284" y="44" text-anchor="middle" font-size="12">sticky-note</text>',
  "</svg>",
].join("");
