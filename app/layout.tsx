import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMEB Archive",
  description: "전 프로게이머 스맵 송경호의 유튜브 · SOOP 다시보기 팬 아카이브",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
