import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "어디서 보지? | 작품별 OTT 제공처 찾기",
  description: "보고 싶은 영화와 드라마를 검색하고 국내 OTT 구독·대여·구매 제공처를 확인하세요.",
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
      <head>
        <meta content="development" name="codex-preview" />
        {/*
          globals.css는 Pretendard를 지정하지만 폰트를 불러오는 곳이 없어서,
          Pretendard가 설치된 PC에서만 의도한 서체로 보였다. 동적 서브셋 CSS는
          필요한 한글 구간만 내려받는다. 실패하면 기존처럼 Noto Sans KR로 대체된다.
        */}
        <link href="https://cdn.jsdelivr.net" rel="preconnect" crossOrigin="" />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
