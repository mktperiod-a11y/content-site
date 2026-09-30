import { getSiteUrl } from "@/lib/site";

/**
 * 구조화 데이터(JSON-LD).
 *
 * 검색엔진과 AI가 페이지를 읽는 용도이며 화면에는 보이지 않는다.
 * 값은 전부 실제로 확인된 것만 넣는다 — 추정치나 지어낸 수치를 넣으면
 * 구조화 데이터가 오히려 신뢰를 깎는다.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const SITE_NAME = "무비시소";

/** 사이트 전체를 설명한다. 검색 결과의 사이트명·검색창 노출에 쓰인다. */
export function websiteSchema() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    inLanguage: "ko-KR",
    description:
      "보고 싶은 영화와 드라마를 검색하고 국내 OTT 구독·대여·구매 제공처를 확인하는 서비스.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * 목록 페이지가 무엇을 모아둔 것인지 알린다.
 * 실제로 화면에 그린 작품만, 화면과 같은 순서로 담는다.
 */
export function itemListSchema({
  name,
  description,
  path,
  items,
}: {
  name: string;
  description: string;
  path: string;
  items: Array<{ titleKo: string; movieCd: string | null }>;
}) {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    url: `${siteUrl}${path}`,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: items.map((movie, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: movie.titleKo,
      ...(movie.movieCd
        ? { url: `${siteUrl}/movie/${encodeURIComponent(movie.movieCd)}` }
        : {}),
    })),
  };
}

/** 작품 상세에서 현재 위치를 알린다. */
export function breadcrumbSchema(trail: Array<{ name: string; path: string }>) {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: `${siteUrl}${step.path}`,
    })),
  };
}
