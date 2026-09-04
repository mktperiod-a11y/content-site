import type { Metadata } from "next";

import { ReleaseCatalogPage } from "@/components/release-catalog-page";

export const metadata: Metadata = {
  title: "개봉 예정 영화 | 어디서 보지?",
  description: "국내 개봉을 앞둔 영화의 개봉일, 포스터와 작품 정보를 미리 확인하세요.",
};

export default function UpcomingMoviesPage() {
  return <ReleaseCatalogPage view="upcoming" />;
}
