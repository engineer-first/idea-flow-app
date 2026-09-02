// idea-support feature の公開境界。
// 発想支援サイドバーを外部へ公開し、
// 内部の表示コンポーネントやコンテンツ定義は feature 内に閉じる。

export type { IdeaGuidePanelProps } from "./molecules/idea-guide-panel";
export { IdeaGuidePanel } from "./molecules/idea-guide-panel";
export { IdeaSupportSidebar } from "./organisms/idea-support-sidebar";
