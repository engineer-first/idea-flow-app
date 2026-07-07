// wrangler types が生成する Env（worker-configuration.d.ts）には
// vars と bindings しか載らない。SESSION_SECRET は secret（本番は
// `wrangler secret put`、ローカルは .dev.vars、テストは miniflare bindings）
// として注入されるため、ここで型に足す。
// 生成物は global の `Env` と `Cloudflare.Env` の両方を定義するため、両方へ足す。
declare global {
  interface Env {
    SESSION_SECRET: string;
  }
  namespace Cloudflare {
    interface Env {
      SESSION_SECRET: string;
    }
  }
}

export {};
