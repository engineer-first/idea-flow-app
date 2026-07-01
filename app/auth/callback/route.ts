import { type NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const redirectTo = next.startsWith("/") ? next : "/";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Supabaseの環境変数を設定してください。")}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");

      if (process.env.NODE_ENV === "development" || !forwardedHost) {
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }

      return NextResponse.redirect(`https://${forwardedHost}${redirectTo}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("ログインに失敗しました。")}`,
  );
}
