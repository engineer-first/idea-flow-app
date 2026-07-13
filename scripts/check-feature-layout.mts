// feature 内ディレクトリ構成の機械検査（CI: check:feature-layout）。
// ast-grep は import 文の検査器でありファイル配置の検査器ではないため、
// 配置の不変条件はこのスクリプトが持つ:
// 1. feature 単位で「フラット or 5 箱」の二択。サブディレクトリは 5 箱の
//    語彙のみ（fail-closed。旧層 ui/ も C′ 移行完了により規約外）。
// 2. 箱を使う feature の root に置けるのは index.ts（公開境界）だけ。
// 3. 箱の中に入れ子ディレクトリを作らない（深さ 2 まで）。帯規則
//    （rules/ast-grep/feature-band-imports.yml）の regex はこの前提に依存する。
// 検査は checkFeatureLayout（純関数）に置き、走査と報告だけを main が持つ。

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export type FeatureLayout = {
  name: string;
  // feature root からの相対パス（ファイルのみ、区切りは "/"）
  paths: string[];
};

export type LayoutViolation = {
  feature: string;
  kind:
    | "unknown-subdirectory"
    | "root-file-beside-layers"
    | "nested-subdirectory";
  path?: string;
  message: string;
};

// C′ の 5 箱（依存権の帯）。
const BAND_BOXES: ReadonlySet<string> = new Set([
  "containers",
  "templates",
  "organisms",
  "molecules",
  "logic",
]);

export function checkFeatureLayout(feature: FeatureLayout): LayoutViolation[] {
  const violations: LayoutViolation[] = [];
  const rootFiles = feature.paths.filter((path) => !path.includes("/"));
  const subdirFiles = feature.paths.filter((path) => path.includes("/"));
  const subdirs = [
    ...new Set(subdirFiles.map((path) => path.split("/")[0] ?? "")),
  ].sort();

  for (const path of subdirFiles) {
    if (path.split("/").length > 2) {
      violations.push({
        feature: feature.name,
        kind: "nested-subdirectory",
        path,
        message: "箱の中にディレクトリを作らない（feature 内は深さ 2 まで）",
      });
    }
  }

  for (const dir of subdirs) {
    if (!BAND_BOXES.has(dir)) {
      violations.push({
        feature: feature.name,
        kind: "unknown-subdirectory",
        path: subdirFiles.find((path) => path.startsWith(`${dir}/`)),
        message: `規約外のサブディレクトリ "${dir}/"。使える箱は containers / templates / organisms / molecules / logic だけ`,
      });
    }
  }

  if (subdirs.length > 0) {
    for (const file of rootFiles) {
      if (file !== "index.ts") {
        violations.push({
          feature: feature.name,
          kind: "root-file-beside-layers",
          path: file,
          message:
            "箱を使う feature の root に置けるのは index.ts（公開境界）だけ（フラット or 5 箱の二択）",
        });
      }
    }
  }

  return violations;
}

export function readFeatureLayouts(rootDir: string): FeatureLayout[] {
  const featuresDir = join(rootDir, "features");
  return readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const featureDir = join(featuresDir, entry.name);
      const paths = readdirSync(featureDir, {
        recursive: true,
        withFileTypes: true,
      })
        .filter((dirent) => dirent.isFile())
        .map((dirent) =>
          relative(featureDir, join(dirent.parentPath, dirent.name)).replaceAll(
            "\\",
            "/",
          ),
        )
        .sort();
      return { name: entry.name, paths };
    });
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  const violations = readFeatureLayouts(process.cwd()).flatMap((feature) =>
    checkFeatureLayout(feature),
  );
  if (violations.length > 0) {
    for (const violation of violations) {
      const location =
        violation.path === undefined ? "" : ` (${violation.path})`;
      console.error(
        `features/${violation.feature}: [${violation.kind}] ${violation.message}${location}`,
      );
    }
    process.exit(1);
  }
}
