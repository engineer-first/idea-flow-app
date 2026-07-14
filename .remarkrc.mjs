import remarkCjkFriendly from "remark-cjk-friendly";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import stringWidth from "string-width";

/** @type {import("unified").Preset} */
const remarkConfig = {
  plugins: [
    remarkFrontmatter,
    [remarkGfm, { stringLength: stringWidth }],
    remarkCjkFriendly,
  ],
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
