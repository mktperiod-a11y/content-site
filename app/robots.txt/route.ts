import { getSiteUrl } from "@/lib/site";

/**
 * 크롤러가 사이트맵을 찾아가도록 robots.txt를 노출한다.
 * `/search`는 결과가 클라이언트에서 그려져 색인할 본문이 없어(noindex) 크롤링에서 제외한다.
 * 내부 API는 크롤러가 호출할 이유가 없고, 호출되면 외부 API 쿼터만 소모한다.
 */
export function GET() {
  const siteUrl = getSiteUrl();
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /search",
    "Disallow: /api/",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
