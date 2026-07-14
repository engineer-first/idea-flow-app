import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import stringWidth from "string-width";

/** @type {import("unified").Preset} */
const remarkConfig = {
  plugins: [remarkFrontmatter, [remarkGfm, { stringLength: stringWidth }]],
  settings: {
    bullet: "-",
    emphasis: "*",
    strong: "*",
    fence: "`",
    fences: true,
    rule: "-",
    ruleSpaces: false,
    listItemIndent: "one",
    tightDefinitions: true,
  },
};

export default remarkConfig;
