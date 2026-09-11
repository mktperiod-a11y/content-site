import type { Metadata } from "next";

// 검색 결과와 가격 비교는 클라이언트에서 그려져 색인할 본문이 없다.
// 링크는 계속 따라가도록 follow는 남긴다.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function SearchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

