import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/app/app-header";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/session/current-user";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IdeaFlow",
  description: "IdeaFlow authentication",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ログイン済みなら共通ヘッダーを出す（login 等は user=null なので非表示）。
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user ? <AppHeader userName={user.name ?? ""} /> : null}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
