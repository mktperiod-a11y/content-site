import { findTmdbMatch, getTmdbWatchProvidersKR } from "@/lib/tmdb";
import type { EnrichedMovie } from "@/lib/enrichment";

/**
 * 검색 결과 목록에 포스터와 국내 제공처 칩을 붙이기 위한 배치 조회.
 *
 * KOBIS에는 OTT 정보가 없어 작품마다 TMDB를 조회해야 하므로 호출량이 빠르게
 * 늘어난다. 그래서 (1) 한 번에 처리할 작품 수를 제한하고, (2) lib/tmdb.ts의
 * 인메모리 캐시에 기대고, (3) 목록 렌더링을 막지 않도록 별도 엔드포인트로 뺐다.
 */

const MAX_ITEMS = 12;

type EnrichRequestItem = {
  movieCd: string;
  titleKo: string;
  titleEn?: string;
  year?: string;
};

export async function POST(request: Request) {
  let body: { items?: EnrichRequestItem[] };
  try {
    body = (await request.json()) as { items?: EnrichRequestItem[] };
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const items = (body.items ?? []).slice(0, MAX_ITEMS);
  if (!items.length) return Response.json({ movies: [] });

  const movies = await Promise.all(
    items.map(async (item): Promise<EnrichedMovie> => {
      const fallback: EnrichedMovie = {
        movieCd: item.movieCd,
        posterUrl: null,
        voteAverage: null,
        voteCount: 0,
        subscription: null,
        rentOrBuyCount: 0,
      };

      try {
        const match = await findTmdbMatch(item.titleKo, item.year, item.titleEn);
        if (!match) return fallback;

        const providers = await getTmdbWatchProvidersKR(match.id);
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
        };
      } catch {
        // 개별 작품 조회 실패가 목록 전체를 막지 않도록 한다.
        return fallback;
      }
    }),
  );

  return Response.json({ movies });
}
