// features/ と app/ の import を解析し、依存図（mermaid テキスト）を
// dependency-diagrams/ へ生成する。Storybook の Dependencies/* stories が
// 静的アセットとして読み込み、ブラウザ側で図にレンダリングする。
// 生成物はコミットしない（.gitignore 済み。tbls の ER 図と同じ扱い）。
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFeatureDiagram,
  buildOverviewDiagram,
  type FeatureInput,
  type SourceFile,
} from "./dependency-graph.mts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "dependency-diagrams");

function collectSourceFiles(baseDir: string): SourceFile[] {
  return readdirSync(baseDir, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.[jt]sx?$/.test(path))
    .sort()
    .map((path) => ({
      path: path.replaceAll("\\", "/"),
      source: readFileSync(join(baseDir, path), "utf8"),
    }));
}

const features: FeatureInput[] = readdirSync(join(ROOT, "features"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .map((name) => ({
    name,
    files: collectSourceFiles(join(ROOT, "features", name)),
  }));

const appFiles = collectSourceFiles(join(ROOT, "app"));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

writeFileSync(
  join(OUT_DIR, "features-overview.mmd"),
  buildOverviewDiagram(features, appFiles),
);
for (const feature of features) {
  writeFileSync(
    join(OUT_DIR, `feature-${feature.name}.mmd`),
    buildFeatureDiagram(feature),
  );
}

console.log(
  `Dependency diagrams written to ${OUT_DIR} (overview + ${features.length} feature(s))`,
);
