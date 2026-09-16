import { getD1 } from "@/db";
import type { EnrichedMovie } from "@/lib/enrichment";
import { normalizeTheaterTitle } from "@/lib/theater-sources";
import type { TmdbMatch, WatchProvidersKR } from "@/lib/tmdb";

const ENRICHMENT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type EnrichmentCacheItem = {
  movieCd: string;
  titleKo: string;
  titleEn?: string;
  year?: string;
  openDate?: string;
};

/**
 * 보강 요청에 담겨 오는 값이 KOBIS가 내려주는 모양인지 확인한다.
 *
 * /api/movies/enrich는 로그인 없이 열려 있는데, 여기로 들어온 항목은 movies
 * 테이블에 그대로 저장된다. movies는 "개봉 예정작" 목록과 sitemap.xml의 원본이라,
 * 아무 값이나 받아주면 없는 작품을 목록과 사이트맵에 밀어 넣을 수 있다.
 * KOBIS 결과는 movieCd가 영숫자, 연도가 4자리, 개봉일이 8자리(또는 빈 문자열)라
 * 정상 요청은 이 검사에 걸리지 않는다.
 */
const MOVIE_CD_PATTERN = /^[0-9A-Za-z]{1,16}$/;
const MAX_TITLE_LENGTH = 200;

export function isTrustedEnrichmentItem(item: EnrichmentCacheItem | undefined) {
  if (!item || typeof item !== "object") return false;
  if (typeof item.movieCd !== "string" || !MOVIE_CD_PATTERN.test(item.movieCd)) return false;
  if (typeof item.titleKo !== "string" || !item.titleKo.trim()) return false;
  if (item.titleKo.length > MAX_TITLE_LENGTH) return false;
  if (item.titleEn !== undefined) {
    if (typeof item.titleEn !== "string" || item.titleEn.length > MAX_TITLE_LENGTH) return false;
  }
  if (item.year !== undefined) {
    if (typeof item.year !== "string" || (item.year && !/^\d{4}$/.test(item.year))) return false;
  }
  if (item.openDate !== undefined) {
    if (typeof item.openDate !== "string" || (item.openDate && !/^\d{8}$/.test(item.openDate))) {
      return false;
    }
  }
  return true;
}

type MovieCacheRow = {
  movie_cd: string;
  poster_url: string | null;
  vote_average: number | null;
  vote_count: number;
  tmdb_id: number | null;
  tmdb_status: string;
  tmdb_updated_at: number | null;
};

type ProviderCacheRow = {
  movie_cd: string;
  provider_name: string;
  logo_url: string | null;
  monetization_type: string;
};

export async function getCachedEnrichments(items: EnrichmentCacheItem[]) {
  const movieCodes = Array.from(new Set(items.map((item) => item.movieCd).filter(Boolean)));
  const result = new Map<string, EnrichedMovie>();
  if (!movieCodes.length) return result;

  const placeholders = movieCodes.map(() => "?").join(",");
  let movieRows: MovieCacheRow[];
  let providerRows: ProviderCacheRow[];
  try {
    const db = getD1();
    const [movieResult, providerResult] = await Promise.all([
      db
        .prepare(
          `SELECT movie_cd, poster_url, vote_average, vote_count, tmdb_id,
                  tmdb_status, tmdb_updated_at
           FROM movies WHERE movie_cd IN (${placeholders})`,
        )
        .bind(...movieCodes)
        .all<MovieCacheRow>(),
      db
        .prepare(
          `SELECT movie_cd, provider_name, logo_url, monetization_type
           FROM movie_providers WHERE movie_cd IN (${placeholders})`,
        )
        .bind(...movieCodes)
        .all<ProviderCacheRow>(),
    ]);
    movieRows = movieResult.results ?? [];
    providerRows = providerResult.results ?? [];
  } catch {
    // 캐시 장애 때문에 실시간 TMDB 조회까지 막히지 않게 한다.
    return result;
  }

  const providersByMovie = new Map<string, ProviderCacheRow[]>();
  for (const provider of providerRows) {
    const current = providersByMovie.get(provider.movie_cd) ?? [];
    current.push(provider);
    providersByMovie.set(provider.movie_cd, current);
  }

  const freshAfter = Date.now() - ENRICHMENT_CACHE_TTL_MS;
  for (const movie of movieRows) {
    if (!movie.tmdb_updated_at || movie.tmdb_updated_at < freshAfter) continue;
    if (movie.tmdb_status !== "matched" && movie.tmdb_status !== "not_found") continue;

    const providers = providersByMovie.get(movie.movie_cd) ?? [];
    result.set(movie.movie_cd, {
      movieCd: movie.movie_cd,
      posterUrl: movie.poster_url,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      subscription:
        movie.tmdb_status === "matched"
          ? providers
              .filter((provider) => provider.monetization_type === "subscription")
              .map((provider) => ({
                name: provider.provider_name,
                logoUrl: provider.logo_url,
              }))
          : null,
      rentOrBuyCount: providers.filter((provider) =>
        provider.monetization_type === "rent" || provider.monetization_type === "buy",
      ).length,
      theaters: [],
    });
  }

  return result;
}

/**
 * 미리 채워둔 TMDB id는 있지만 제공처까지 저장된 상태는 아닌 행의 표시.
 *
 * getCachedEnrichments가 믿는 값('matched'/'not_found')을 피해야 한다.
 * id만 아는 상태를 'matched'로 적으면 제공처를 확인한 적이 없는데도
 * 검색 결과가 "구독처 없음"을 확정으로 말하게 된다.
 */
export const TMDB_ID_ONLY_STATUS = "id_only";
/** 같은 이유로, id 조회에 실패한 것도 별도 값으로 남긴다. */
export const TMDB_ID_NOT_FOUND_STATUS = "id_not_found";
/** 조회 중 오류가 난 경우. 역시 캐시가 신뢰하는 값이 아니다. */
export const TMDB_ID_ERROR_STATUS = "id_error";

export async function getStoredTmdbState(movieCd: string) {
  try {
    const row = await getD1()
      .prepare("SELECT tmdb_id, tmdb_status FROM movies WHERE movie_cd = ?")
      .bind(movieCd)
      .first<{ tmdb_id: number | null; tmdb_status: string }>();
    return {
      tmdbId: row?.tmdb_id ?? null,
      /** 제공처까지 저장돼 있는지. 아니면 상세 조회 결과를 저장해 캐시를 채운다. */
      isFullyCached: row?.tmdb_status === "matched",
    };
  } catch {
    return { tmdbId: null, isFullyCached: false };
  }
}

export async function persistEnrichment(
  item: EnrichmentCacheItem,
  match: TmdbMatch | null,
  providers: WatchProvidersKR | null,
) {
  // 저장 직전에 한 번 더 확인한다. 라우트가 걸러도, 다른 호출자가 생겼을 때
  // movies 테이블에 검증되지 않은 값이 들어가지 않도록 한다.
  if (!isTrustedEnrichmentItem(item)) return;

  const db = getD1();
  const now = Date.now();

  if (!match) {
    await db
      .prepare(
        `INSERT INTO movies
           (movie_cd, title_ko, normalized_title, title_en, production_year,
            open_date, tmdb_status, tmdb_updated_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'not_found', ?, ?)
         ON CONFLICT(movie_cd) DO UPDATE SET
           title_ko = excluded.title_ko,
           normalized_title = excluded.normalized_title,
           title_en = COALESCE(NULLIF(excluded.title_en, ''), movies.title_en),
           production_year = COALESCE(NULLIF(excluded.production_year, ''), movies.production_year),
           open_date = COALESCE(NULLIF(excluded.open_date, ''), movies.open_date),
           tmdb_status = CASE WHEN movies.tmdb_id IS NULL THEN 'not_found' ELSE movies.tmdb_status END,
           tmdb_updated_at = CASE WHEN movies.tmdb_id IS NULL THEN excluded.tmdb_updated_at ELSE movies.tmdb_updated_at END,
           updated_at = excluded.updated_at`,
      )
      .bind(
        item.movieCd,
        item.titleKo,
        normalizeTheaterTitle(item.titleKo),
        item.titleEn ?? "",
        item.year ?? "",
        item.openDate ?? "",
        now,
        now,
      )
      .run();
    return;
  }

  const statements = [
    db
      .prepare(
        `INSERT INTO movies
           (movie_cd, title_ko, normalized_title, title_en, production_year,
            open_date, tmdb_id, poster_url, vote_average, vote_count,
            tmdb_status, tmdb_updated_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'matched', ?, ?)
         ON CONFLICT(movie_cd) DO UPDATE SET
           title_ko = excluded.title_ko,
           normalized_title = excluded.normalized_title,
           title_en = COALESCE(NULLIF(excluded.title_en, ''), movies.title_en),
           production_year = COALESCE(NULLIF(excluded.production_year, ''), movies.production_year),
           open_date = COALESCE(NULLIF(excluded.open_date, ''), movies.open_date),
           tmdb_id = excluded.tmdb_id,
           poster_url = excluded.poster_url,
           vote_average = excluded.vote_average,
           vote_count = excluded.vote_count,
           tmdb_status = 'matched',
           tmdb_updated_at = excluded.tmdb_updated_at,
           updated_at = excluded.updated_at`,
      )
      .bind(
        item.movieCd,
        item.titleKo,
        normalizeTheaterTitle(item.titleKo),
        item.titleEn ?? "",
        item.year ?? "",
        item.openDate ?? "",
        match.id,
        match.posterUrl,
        match.voteAverage,
        match.voteCount,
        now,
        now,
      ),
    db.prepare("DELETE FROM movie_providers WHERE movie_cd = ?").bind(item.movieCd),
  ];

  for (const [type, values] of [
    ["subscription", providers?.subscription ?? []],
    ["rent", providers?.rent ?? []],
    ["buy", providers?.buy ?? []],
  ] as const) {
    for (const provider of values) {
      statements.push(
        db
          .prepare(
            `INSERT INTO movie_providers
               (movie_cd, provider_id, provider_name, logo_url, monetization_type,
                source_url, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            item.movieCd,
            provider.providerId,
            provider.name,
            provider.logoUrl,
            type,
            providers?.link ?? "",
            now,
          ),
      );
    }
  }

  await db.batch(statements);
}
