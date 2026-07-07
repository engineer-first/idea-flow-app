// 開発用の固定ユーザー。isDevAuthEnabled() のときだけログインに使える。
// ID は安定させる（D1 をリセットしても同じユーザーとして復元されるように）。
export type DevUser = {
  id: string;
  email: string;
  name: string;
};

export const DEV_PASSWORD = "password";

export const DEV_USERS: readonly DevUser[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@example.test",
    name: "Owner",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "member@example.test",
    name: "Member",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    email: "viewer@example.test",
    name: "Viewer",
  },
];

export function findDevUser(email: string): DevUser | null {
  return DEV_USERS.find((user) => user.email === email) ?? null;
}
