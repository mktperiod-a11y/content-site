import type { Metadata } from "next";

import { ReleaseCatalogPage } from "@/components/release-catalog-page";

export const metadata: Metadata = {
  title: "최신 개봉 영화 | 어디서 보지?",
  description: "최근 국내 개봉 영화의 개봉일, 포스터, 평점과 OTT 제공처를 확인하세요.",
};

export default function NowPlayingPage() {
  return <ReleaseCatalogPage view="now" />;
}
