// ログインフォームの開発用ログインの初期値。
// 値の真実は lib/session/dev-users.ts（サーバー側の検証もここを使う）に置き、
// フォームの初期表示がそれと乖離しないよう単一ソースから導出する。
import { DEV_PASSWORD, DEV_USERS } from "@/lib/session/dev-users";

export const DEV_AUTH_DEFAULT_EMAIL = DEV_USERS[0]?.email ?? "";
export const DEV_AUTH_DEFAULT_PASSWORD = DEV_PASSWORD;
