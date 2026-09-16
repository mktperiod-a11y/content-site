import type { Metadata } from "next";

import { ReleaseCatalogPage } from "@/components/release-catalog-page";

export const metadata: Metadata = {
  // sitemap.xml이 가리키는 주소와 같은 주소를 정본으로 알린다.
  // 상대 경로는 app/layout.tsx의 metadataBase 기준으로 풀린다.
  alternates: { canonical: "/movies/upcoming" },
  title: "개봉 예정 영화 | 어디서 보지?",
  description: "국내 개봉을 앞둔 영화의 개봉일, 포스터와 작품 정보를 미리 확인하세요.",
};

export default function UpcomingMoviesPage() {
  return <ReleaseCatalogPage view="upcoming" />;
}
