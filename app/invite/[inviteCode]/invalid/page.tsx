import Link from "next/link";

export const dynamic = "force-dynamic";

// 招待URL が無効（存在しないコード・削除済みルーム等）だったときの案内。
// 招待URL の有効期限管理は現状スコープ外のため、文言は「無効」に統一する。
export default function InvalidInvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          招待リンクが無効です
        </h1>
        <p className="text-sm text-slate-500">
          この招待リンクは使用できませんでした。リンクが間違っているか、
          ルームがすでに存在しない可能性があります。ホストに新しい招待URLの
          発行を依頼してください。
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          トップへ戻る
        </Link>
      </div>
    </main>
  );
}
