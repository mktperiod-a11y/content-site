import type { Metadata } from "next";
import "./globals.css";
import { getSiteUrl } from "@/lib/site";

const TITLE = "어디서 보지? | 작품별 OTT 제공처 찾기";
const DESCRIPTION =
  "보고 싶은 영화와 드라마를 검색하고 국내 OTT 구독·대여·구매 제공처를 확인하세요.";

export const metadata: Metadata = {
  // 하위 페이지가 상대 경로로 canonical·og:url을 써도 절대 주소로 풀리게 한다.
  metadataBase: new URL(getSiteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  // 링크를 공유했을 때 미리보기가 뜨도록 한다. 각 페이지의 title/description을
  // 그대로 물려받으므로 페이지별로 따로 적을 필요가 없다.
  openGraph: {
    type: "website",
    siteName: "어디서 보지?",
    locale: "ko_KR",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
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
