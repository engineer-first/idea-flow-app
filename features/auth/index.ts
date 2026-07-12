// auth feature（ログイン・ログアウト・OAuth コールバック支援）の公開境界。
// lib/session（Cookie / JWT の発行・検証）はインフラとして別レイヤーに置き、
// ここは「ログイン UI と認証フローの配線」だけを持つ。
export {
  signInWithDevPassword,
  signInWithGoogle,
  signOut,
} from "./actions";
export { isEmailVerified } from "./google-claims";
export { LoginCard } from "./login-card";
export { getLoginPath, sanitizeNextPath } from "./redirects";
