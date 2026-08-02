import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "스맵 아카이브 | SMEB Archive",
  description: "전 프로게이머 스맵(송경호) 팬 아카이브. 유튜브 월별 TOP 10, SOOP 다시보기 캘린더, 최신 공지를 한눈에.",
  keywords: ["스맵", "스맵 아카이브", "송경호", "smeb", "smeb archive", "스맵 유튜브", "스맵 다시보기", "스맵 SOOP", "롤 스트리머", "스맵 팬카페", "스맵 멸망전", "스맵 연간결산", "League of Legends streamer", "스맵 방송", "스맵 스트리머"],
  authors: [{ name: "SMEB Archive" }],
  verification: {
    // 네이버 서치어드바이저 인증코드 - searchadvisor.naver.com에서 발급 후 여기에 입력
    // other: { "naver-site-verification": "인증코드입력" }
  },
  creator: "SMEB Archive",
  openGraph: {
    type: "website",
    url: "https://www.smebarchive.xyz",
    title: "스맵 아카이브 | SMEB Archive",
    description: "전 프로게이머 스맵(송경호) 팬 아카이브. 유튜브 월별 TOP 10, SOOP 다시보기 캘린더를 한눈에.",
    siteName: "스맵 아카이브",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: "스맵 아카이브 | SMEB Archive",
    description: "전 프로게이머 스맵(송경호) 팬 아카이브. 유튜브 월별 TOP 10, SOOP 다시보기.",
  },
  alternates: {
    canonical: "https://www.smebarchive.xyz",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  verification: {
    google: "mzp7BA37u1o_a1oD6NVDWR1IYvyzMnTK4x_02KycWUo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="naverbot" content="index, follow" />
      <meta name="yeti" content="index, follow" />
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
