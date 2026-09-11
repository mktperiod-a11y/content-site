import { getSitemapMovieCodes } from "@/lib/release-catalog";

const FALLBACK_SITE_URL = "https://where-to-watch-kr.so0yeon.chatgpt.site";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlEntry(
  siteUrl: string,
  path: string,
  lastModified: Date,
  changeFrequency: "daily" | "weekly",
  priority: number,
) {
  return `<url><loc>${escapeXml(`${siteUrl}${path}`)}</loc><lastmod>${lastModified.toISOString()}</lastmod><changefreq>${changeFrequency}</changefreq><priority>${priority}</priority></url>`;
}

export async function GET() {
  const siteUrl = (process.env.PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/$/, "");
  const movies = await getSitemapMovieCodes();
  const now = new Date();
  // 루트는 /movies/now 로 리다이렉트하고 검색 화면은 noindex라 둘 다 뺀다.
  const entries = [
    urlEntry(siteUrl, "/movies/now", now, "daily", 1),
    urlEntry(siteUrl, "/movies/upcoming", now, "daily", 0.9),
    ...movies.map((movie) =>
      urlEntry(
        siteUrl,
        `/movie/${encodeURIComponent(movie.movie_cd)}`,
        new Date(movie.updated_at),
        "weekly",
        0.7,
      ),
    ),
  ];

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
