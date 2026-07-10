// ルート `/` はホームへ寄せる。実体は app/home/page.tsx。
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/home");
}
