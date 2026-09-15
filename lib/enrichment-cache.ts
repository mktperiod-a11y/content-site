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

export async function getStoredTmdbId(movieCd: string) {
  try {
    const row = await getD1()
      .prepare("SELECT tmdb_id FROM movies WHERE movie_cd = ?")
      .bind(movieCd)
      .first<{ tmdb_id: number | null }>();
    return row?.tmdb_id ?? null;
  } catch {
    return null;
  }
}

export async function persistEnrichment(
  item: EnrichmentCacheItem,
  match: TmdbMatch | null,
  providers: WatchProvidersKR | null,
) {
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
