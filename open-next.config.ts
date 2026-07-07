// OpenNext (Cloudflare アダプタ) の設定。
// キャッシュ層 (R2/DO Queue) は使わない最小構成から始める。
// このアプリは認証必須の動的ページのみで ISR/SSG キャッシュの恩恵がないため、
// incremental cache を持たないことが現時点の意図。
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
