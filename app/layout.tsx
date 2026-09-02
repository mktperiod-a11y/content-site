import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "어디서 보지? | 작품별 OTT 제공처 찾기",
  description: "보고 싶은 영화와 드라마를 검색하고 국내 OTT 구독·대여·구매 제공처를 확인하세요.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
