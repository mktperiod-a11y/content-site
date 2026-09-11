import { getD1 } from "@/db";
import {
  listKobisMoviesByOpenDate,
  type KobisMovieSummary,
} from "@/lib/kobis";
import {
  findTmdbMatch,
  getTmdbWatchProvidersKR,
  type WatchProvider,
} from "@/lib/tmdb";
import {
  getConfirmedTheatersByTitle,
  getLatestTheaterRefresh,
} from "@/lib/theater-catalog";
import { normalizeTheaterTitle, type TheaterCode } from "@/lib/theater-sources";

export const RELEASE_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const RELEASE_LOCK_MS = 5 * 60 * 1000;
const CURRENT_LOOKBACK_DAYS = 60;
const UPCOMING_LOOKAHEAD_DAYS = 120;
const RELEASE_PAGE_LIMIT = 24;
const ENRICHMENT_LIMIT_PER_VIEW = 24;
const SYNC_KEY = "release_catalog";

export type ReleaseView = "now" | "upcoming";

export type ReleaseProvider = {
  providerId: number;
  name: string;
  logoUrl: string | null;
  type: "subscription" | "rent" | "buy";
};

export type ReleaseMovie = {
  movieCd: string | null;
  titleKo: string;
  titleEn: string;
  productionYear: string;
  openDate: string;
  genres: string[];
  nations: string[];
  directors: string[];
  tmdbId: number | null;
  posterUrl: string | null;
  voteAverage: number | null;
  voteCount: number;
  providers: ReleaseProvider[];
  theaters: TheaterCode[];
};

export type ReleaseCatalogResult = {
  movies: ReleaseMovie[];
  lastSuccessAt: number | null;
  stale: boolean;
  unavailable: boolean;
};

type MovieRow = {
  movie_cd: string | null;
  title_ko: string;
  normalized_title: string;
  title_en: string;
  production_year: string;
  open_date: string;
  genre_text: string;
  nation_text: string;
  directors_json: string;
  tmdb_id: number | null;
  poster_url: string | null;
  vote_average: number | null;
  vote_count: number;
};

type ProviderRow = {
  movie_cd: string;
  provider_id: number;
  provider_name: string;
  logo_url: string | null;
  monetization_type: ReleaseProvider["type"];
};

type SyncRow = {
  last_success_at: number | null;
  lock_until: number;
  lock_token: string | null;
};

function splitText(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseDirectors(value: string) {
  try {
    const result = JSON.parse(value) as unknown;
    return Array.isArray(result)
      ? result.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function getKoreaDateString(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function getReleaseWindow(now = new Date()) {
  return {
    today: getKoreaDateString(now),
    start: getKoreaDateString(addDays(now, -CURRENT_LOOKBACK_DAYS)),
    end: getKoreaDateString(addDays(now, UPCOMING_LOOKAHEAD_DAYS)),
  };
}

async function getSyncRow(): Promise<SyncRow | null> {
  return getD1()
    .prepare(
      `SELECT last_success_at, lock_until, lock_token
       FROM sync_state
       WHERE sync_key = ?`,
    )
    .bind(SYNC_KEY)
    .first<SyncRow>();
}

export async function getReleaseCatalog(
  view: ReleaseView,
  limit = RELEASE_PAGE_LIMIT,
): Promise<ReleaseCatalogResult> {
  try {
    const db = getD1();
    const now = Date.now();
    const window = getReleaseWindow(new Date(now));
    const safeLimit = Math.min(Math.max(limit, 1), RELEASE_PAGE_LIMIT);
    const movieQuery = view === "now"
      ? db
          .prepare(
            `WITH theater_titles AS (
               SELECT normalized_title,
                      MIN(title_ko) AS title_ko,
                      MAX(open_date) AS open_date
               FROM theater_movies
               WHERE booking_available = 1
               GROUP BY normalized_title
             )
             SELECT m.movie_cd,
                    COALESCE(NULLIF(m.title_ko, ''), theater_titles.title_ko) AS title_ko,
                    theater_titles.normalized_title,
                    COALESCE(m.title_en, '') AS title_en,
                    COALESCE(NULLIF(m.production_year, ''), SUBSTR(theater_titles.open_date, 1, 4), '') AS production_year,
                    COALESCE(NULLIF(m.open_date, ''), theater_titles.open_date, '') AS open_date,
                    COALESCE(m.genre_text, '') AS genre_text,
                    COALESCE(m.nation_text, '') AS nation_text,
                    COALESCE(m.directors_json, '[]') AS directors_json,
                    m.tmdb_id,
                    m.poster_url,
                    m.vote_average,
                    COALESCE(m.vote_count, 0) AS vote_count
             FROM theater_titles
             LEFT JOIN movies AS m ON m.movie_cd = (
               SELECT candidate.movie_cd
               FROM movies AS candidate
               WHERE candidate.normalized_title = theater_titles.normalized_title
               ORDER BY candidate.open_date DESC
               LIMIT 1
             )
             ORDER BY open_date DESC, title_ko ASC
             LIMIT ?`,
          )
          .bind(safeLimit)
      : db
          .prepare(
            `SELECT movie_cd, title_ko, normalized_title, title_en, production_year, open_date,
                    genre_text, nation_text, directors_json, tmdb_id, poster_url,
                    vote_average, vote_count
             FROM movies
             WHERE open_date > ? AND open_date <= ?
             ORDER BY open_date ASC, title_ko ASC
             LIMIT ?`,
          )
          .bind(window.today, window.end, safeLimit);

    const [movieResult, sync, theaterRefresh] = await Promise.all([
      movieQuery.all<MovieRow>(),
      getSyncRow(),
      getLatestTheaterRefresh(),
    ]);

    const rows = movieResult.results ?? [];
    const movieCodes = rows
      .map((row) => row.movie_cd)
      .filter((movieCd): movieCd is string => Boolean(movieCd));
    const providersByMovie = new Map<string, ReleaseProvider[]>();
    const theatersByTitle = await getConfirmedTheatersByTitle(
      rows.map((row) => row.title_ko),
    );

    if (movieCodes.length) {
      const placeholders = movieCodes.map(() => "?").join(",");
      const providerResult = await db
        .prepare(
          `SELECT movie_cd, provider_id, provider_name, logo_url, monetization_type
           FROM movie_providers
           WHERE movie_cd IN (${placeholders})
           ORDER BY monetization_type ASC, provider_name ASC`,
        )
        .bind(...movieCodes)
        .all<ProviderRow>();

      for (const provider of providerResult.results ?? []) {
        const current = providersByMovie.get(provider.movie_cd) ?? [];
        current.push({
          providerId: provider.provider_id,
          name: provider.provider_name,
          logoUrl: provider.logo_url,
          type: provider.monetization_type,
        });
        providersByMovie.set(provider.movie_cd, current);
      }
    }

    return {
      movies: rows.map((row) => ({
        movieCd: row.movie_cd,
        titleKo: row.title_ko,
        titleEn: row.title_en,
        productionYear: row.production_year,
        openDate: row.open_date,
        genres: splitText(row.genre_text),
        nations: splitText(row.nation_text),
        directors: parseDirectors(row.directors_json),
        tmdbId: row.tmdb_id,
        posterUrl: row.poster_url,
        voteAverage: row.vote_average,
        voteCount: row.vote_count,
        providers: row.movie_cd ? providersByMovie.get(row.movie_cd) ?? [] : [],
        theaters: theatersByTitle.get(row.normalized_title) ?? [],
      })),
      lastSuccessAt: view === "now" ? theaterRefresh.lastSuccessAt : sync?.last_success_at ?? null,
      stale: view === "now"
        ? theaterRefresh.stale
        : !sync?.last_success_at || now - sync.last_success_at >= RELEASE_SYNC_INTERVAL_MS,
      unavailable: false,
    };
  } catch (error) {
    console.error("Failed to read release catalog", error);
    return { movies: [], lastSuccessAt: null, stale: true, unavailable: true };
  }
}

async function acquireSyncLock(now: number, token: string) {
  const db = getD1();
  await db
    .prepare(
      `INSERT INTO sync_state
         (sync_key, last_success_at, lock_until, lock_token, status, last_error, updated_at)
       VALUES (?, NULL, ?, ?, 'running', NULL, ?)
       ON CONFLICT(sync_key) DO UPDATE SET
         lock_until = excluded.lock_until,
         lock_token = excluded.lock_token,
         status = 'running',
         last_error = NULL,
         updated_at = excluded.updated_at
       WHERE (sync_state.last_success_at IS NULL OR sync_state.last_success_at <= ?)
         AND sync_state.lock_until < ?`,
    )
    .bind(
      SYNC_KEY,
      now + RELEASE_LOCK_MS,
      token,
      now,
      now - RELEASE_SYNC_INTERVAL_MS,
      now,
    )
    .run();

  const state = await getSyncRow();
  return state?.lock_token === token;
}

function upsertMovieStatement(movie: KobisMovieSummary, now: number) {
  return getD1()
    .prepare(
      `INSERT INTO movies
         (movie_cd, title_ko, normalized_title, title_en, production_year, open_date,
          genre_text, nation_text, directors_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(movie_cd) DO UPDATE SET
         title_ko = excluded.title_ko,
         normalized_title = excluded.normalized_title,
         title_en = excluded.title_en,
         production_year = excluded.production_year,
         open_date = excluded.open_date,
         genre_text = excluded.genre_text,
         nation_text = excluded.nation_text,
         directors_json = excluded.directors_json,
         updated_at = excluded.updated_at`,
    )
    .bind(
      movie.movieCd,
      movie.titleKo,
      normalizeTheaterTitle(movie.titleKo),
      movie.titleEn,
      movie.prdtYear,
      movie.openDt,
      movie.genreAlt,
      movie.nationAlt,
      JSON.stringify(movie.directors),
      now,
    );
}

async function batchStatements(statements: D1PreparedStatement[]) {
  const db = getD1();
  for (let index = 0; index < statements.length; index += 50) {
    await db.batch(statements.slice(index, index + 50));
  }
}

function selectEnrichmentTargets(
  movies: KobisMovieSummary[],
  today: string,
) {
  const current = movies
    .filter((movie) => movie.openDt <= today)
    .sort((a, b) => b.openDt.localeCompare(a.openDt))
    .slice(0, ENRICHMENT_LIMIT_PER_VIEW);
  const upcoming = movies
    .filter((movie) => movie.openDt > today)
    .sort((a, b) => a.openDt.localeCompare(b.openDt))
    .slice(0, ENRICHMENT_LIMIT_PER_VIEW);
  return [...current, ...upcoming];
}

function providerStatements(
  movieCd: string,
  providers: Array<{ type: ReleaseProvider["type"]; items: WatchProvider[] }>,
  sourceUrl: string,
  now: number,
) {
  const db = getD1();
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM movie_providers WHERE movie_cd = ?").bind(movieCd),
  ];

  for (const group of providers) {
    for (const provider of group.items) {
      statements.push(
        db
          .prepare(
            `INSERT INTO movie_providers
               (movie_cd, provider_id, provider_name, logo_url, monetization_type,
                source_url, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            movieCd,
            provider.providerId,
            provider.name,
            provider.logoUrl,
            group.type,
            sourceUrl,
            now,
          ),
      );
    }
  }

  return statements;
}

async function enrichMovie(movie: KobisMovieSummary, now: number) {
  const db = getD1();
  try {
    const match = await findTmdbMatch(movie.titleKo, movie.prdtYear, movie.titleEn);
    if (!match) {
      await db
        .prepare(
          `UPDATE movies
           SET tmdb_status = 'not_found', tmdb_updated_at = ?
           WHERE movie_cd = ?`,
        )
        .bind(now, movie.movieCd)
        .run();
      return;
    }

    const providers = await getTmdbWatchProvidersKR(match.id);
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE movies
           SET tmdb_id = ?, poster_url = ?, vote_average = ?, vote_count = ?,
               tmdb_status = 'matched', tmdb_updated_at = ?
           WHERE movie_cd = ?`,
        )
        .bind(
          match.id,
          match.posterUrl,
          match.voteAverage,
          match.voteCount,
          now,
          movie.movieCd,
        ),
      ...providerStatements(
        movie.movieCd,
        [
          { type: "subscription", items: providers?.subscription ?? [] },
          { type: "rent", items: providers?.rent ?? [] },
          { type: "buy", items: providers?.buy ?? [] },
        ],
        providers?.link ?? "",
        now,
      ),
    ];
    await batchStatements(statements);
  } catch (error) {
    console.error(`Failed to enrich release movie ${movie.movieCd}`, error);
    await db
      .prepare(
        `UPDATE movies
         SET tmdb_status = 'error', tmdb_updated_at = ?
         WHERE movie_cd = ?`,
      )
      .bind(now, movie.movieCd)
      .run();
  }
}

async function enrichMovies(movies: KobisMovieSummary[], now: number) {
  const concurrency = 4;
  for (let index = 0; index < movies.length; index += concurrency) {
    await Promise.allSettled(
      movies.slice(index, index + concurrency).map((movie) => enrichMovie(movie, now)),
    );
  }
}

export async function syncReleaseCatalog() {
  const db = getD1();
  const now = Date.now();
  const token = crypto.randomUUID();
  const acquired = await acquireSyncLock(now, token);
  if (!acquired) return { refreshed: false, reason: "fresh_or_running" as const };

  try {
    const window = getReleaseWindow(new Date(now));
    const movies = await listKobisMoviesByOpenDate(window.start, window.end);
    await batchStatements(movies.map((movie) => upsertMovieStatement(movie, now)));
    await enrichMovies(selectEnrichmentTargets(movies, window.today), now);

    await db
      .prepare(
        `UPDATE sync_state
         SET last_success_at = ?, lock_until = 0, lock_token = NULL,
             status = 'idle', last_error = NULL, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(now, now, SYNC_KEY, token)
      .run();

    return { refreshed: true, count: movies.length };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";
    await db
      .prepare(
        `UPDATE sync_state
         SET lock_until = 0, lock_token = NULL, status = 'error',
             last_error = ?, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(message, Date.now(), SYNC_KEY, token)
      .run();
    throw error;
  }
}

export async function getSitemapMovieCodes(limit = 2000) {
  try {
    const result = await getD1()
      .prepare(
        `SELECT movie_cd, updated_at
         FROM movies
         WHERE open_date != ''
         ORDER BY open_date DESC
         LIMIT ?`,
      )
      .bind(Math.min(Math.max(limit, 1), 5000))
      .all<{ movie_cd: string; updated_at: number }>();
    return result.results ?? [];
  } catch (error) {
    console.error("Failed to read sitemap movies", error);
    return [];
  }
}
