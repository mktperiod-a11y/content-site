import { findTmdbMatch, getTmdbWatchProvidersKR } from "@/lib/tmdb";
import type { EnrichedMovie } from "@/lib/enrichment";
import {
  getCachedEnrichments,
  isTrustedEnrichmentItem,
  persistEnrichment,
  type EnrichmentCacheItem,
} from "@/lib/enrichment-cache";
import { getConfirmedTheatersByTitle } from "@/lib/theater-catalog";
import { normalizeTheaterTitle } from "@/lib/theater-sources";

/**
 * 검색 결과 목록에 포스터와 국내 제공처 칩을 붙이기 위한 배치 조회.
 *
 * KOBIS에는 OTT 정보가 없어 작품마다 TMDB를 조회해야 하므로 호출량이 빠르게
 * 늘어난다. 그래서 (1) 한 번에 처리할 작품 수를 제한하고, (2) lib/tmdb.ts의
 * 인메모리 캐시에 기대고, (3) 목록 렌더링을 막지 않도록 별도 엔드포인트로 뺐다.
 */

const MAX_ITEMS = 12;

type EnrichRequestItem = EnrichmentCacheItem;

export async function POST(request: Request) {
  let body: { items?: EnrichRequestItem[] };
  try {
    body = (await request.json()) as { items?: EnrichRequestItem[] };
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // KOBIS 결과의 모양이 아닌 항목은 외부 API도 부르지 않고 저장도 하지 않는다.
  // 이 엔드포인트는 공개되어 있고, 저장 결과가 개봉 예정작 목록과 사이트맵에 쓰인다.
  const items = (Array.isArray(body.items) ? body.items : [])
    .filter(isTrustedEnrichmentItem)
    .slice(0, MAX_ITEMS);
  if (!items.length) return Response.json({ movies: [] });

  const [theatersByTitle, cached] = await Promise.all([
    getConfirmedTheatersByTitle(items.map((item) => item.titleKo)),
    getCachedEnrichments(items),
  ]);

  const movies = await Promise.all(
    items.map(async (item): Promise<EnrichedMovie> => {
      const fallback: EnrichedMovie = {
        movieCd: item.movieCd,
        posterUrl: null,
        voteAverage: null,
        voteCount: 0,
        subscription: null,
        rentOrBuyCount: 0,
        theaters: theatersByTitle.get(normalizeTheaterTitle(item.titleKo)) ?? [],
      };

      const cachedMovie = cached.get(item.movieCd);
      if (cachedMovie) return { ...cachedMovie, theaters: fallback.theaters };

      try {
        const match = await findTmdbMatch(item.titleKo, item.year, item.titleEn);
        if (!match) {
          await persistEnrichment(item, null, null).catch((error) => {
            console.error("TMDB 미매칭 결과 저장 실패", error);
          });
          return fallback;
        }

        const providers = await getTmdbWatchProvidersKR(match.id);
        await persistEnrichment(item, match, providers).catch((error) => {
          console.error("TMDB 보강 결과 저장 실패", error);
        });
        return {
          movieCd: item.movieCd,
          posterUrl: match.posterUrl,
          voteAverage: match.voteAverage,
          voteCount: match.voteCount,
          // 제공처 응답이 없으면 "구독처 없음"으로 확인된 것으로 본다.
          subscription: (providers?.subscription ?? []).map((provider) => ({
            name: provider.name,
            logoUrl: provider.logoUrl,
          })),
          rentOrBuyCount: (providers?.rent.length ?? 0) + (providers?.buy.length ?? 0),
          theaters: fallback.theaters,
        };
      } catch {
        // 개별 작품 조회 실패가 목록 전체를 막지 않도록 한다.
        return fallback;
      }
    }),
  );

  return Response.json({ movies });
}
