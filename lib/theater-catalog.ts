import { getD1 } from "@/db";
import {
  TMDB_ID_ERROR_STATUS,
  TMDB_ID_NOT_FOUND_STATUS,
  TMDB_ID_ONLY_STATUS,
} from "@/lib/enrichment-cache";
import { listKobisMoviesByTitle, type KobisMovieSummary } from "@/lib/kobis";
import {
  findTmdbMatch,
  listTmdbExactTitleMatches,
  type TmdbTitleCandidate,
} from "@/lib/tmdb";
import {
  THEATER_CODES,
  THEATER_SOURCE_LOADERS,
  normalizeTheaterTitle,
  stripScreeningTags,
  type TheaterCode,
  type TheaterSourceMovie,
} from "@/lib/theater-sources";

export const THEATER_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const THEATER_LOCK_MS = 5 * 60 * 1000;
const THEATER_POSTER_LOCK_MS = 10 * 60 * 1000;
const THEATER_POSTER_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
const THEATER_POSTER_BATCH_LIMIT = 120;
const THEATER_POSTER_SYNC_KEY = "theater_posters";
const THEATER_KOBIS_SYNC_KEY = "theater_kobis";
const THEATER_KOBIS_LOCK_MS = 10 * 60 * 1000;
/**
 * KOBIS에 없는 제목은 대체로 계속 없다. 다만 재개봉 편성이 뒤늦게 등록되는
 * 경우가 있어 일주일마다 한 번은 다시 물어본다.
 */
const THEATER_KOBIS_RETRY_MS = 7 * 24 * 60 * 60 * 1000;
/** 한 제목당 KOBIS 호출 1회. 한 번에 도는 양을 묶어둔다. */
const THEATER_KOBIS_BATCH_LIMIT = 40;
const THEATER_TMDB_SYNC_KEY = "theater_movie_tmdb";
const THEATER_TMDB_LOCK_MS = 10 * 60 * 1000;
const THEATER_TMDB_RETRY_MS = 7 * 24 * 60 * 60 * 1000;
/** 한 작품당 TMDB 호출 1회. */
const THEATER_TMDB_BATCH_LIMIT = 40;
/**
 * last_success_at은 수집이 "끝난" 시각이라 크론이 뜬 시각보다 항상 조금 뒤다.
 * 그래서 TTL을 정확히 24시간으로 재면 다음 날 같은 시각의 크론이 매번
 * 몇 초 차이로 튕겨서 실제로는 이틀에 한 번만 수집된다.
 * 크론 지터와 수집 소요 시간을 흡수할 여유를 둔다.
 */
const SYNC_SLACK_MS = 60 * 60 * 1000;
/**
 * 수집이 실패하면 lock_until을 이만큼 앞으로 잡아 재시도를 잠시 막는다.
 * 실패 직후 잠금을 풀어버리면, stale 상태가 계속 true라서 방문자가 페이지를
 * 열 때마다 /api/releases/refresh가 자동으로 돌고 외부 API를 다시 때린다.
 * 상대가 장애일 때 우리가 부하를 더 얹는 셈이라, 짧은 쿨다운을 둔다.
 * 수집 주기(24시간/7일)보다 훨씬 짧아 정상 갱신을 늦추지 않는다.
 */
export const SYNC_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

export type TheaterAvailability = "confirmed" | "unavailable" | "unknown";

export type TheaterStatus = {
  code: TheaterCode;
  availability: TheaterAvailability;
  bookingAvailable: boolean;
};

type SyncRow = {
  sync_key: string;
  last_success_at: number | null;
  lock_until?: number;
  lock_token: string | null;
  status: string;
};

type TheaterPosterTarget = {
  normalized_title: string;
  title_ko: string;
  /** 극장 개봉일(YYYYMMDD). 재개봉이면 원래 개봉보다 늦다. */
  open_date: string | null;
  /** 같은 제목으로 KOBIS 에 등록된 작품의 제작연도. 있으면 이것이 기준 연도다. */
  production_year: string | null;
};

type TheaterRow = {
  theater_code: TheaterCode;
  normalized_title: string;
  booking_available: number;
  kobis_status?: string;
  kobis_movie_cd?: string | null;
};

function syncKey(code: TheaterCode) {
  return `theater:${code}`;
}

async function getSyncState(code: TheaterCode) {
  return getD1()
    .prepare(
      `SELECT sync_key, last_success_at, lock_token, status
       FROM sync_state WHERE sync_key = ?`,
    )
    .bind(syncKey(code))
    .first<SyncRow>();
}

async function acquireLock(code: TheaterCode, now: number, token: string) {
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
      syncKey(code),
      now + THEATER_LOCK_MS,
      token,
      now,
      now - (THEATER_SYNC_INTERVAL_MS - SYNC_SLACK_MS),
      now,
    )
    .run();
  return (await getSyncState(code))?.lock_token === token;
}

async function runBatches(statements: D1PreparedStatement[]) {
  const db = getD1();
  for (let index = 0; index < statements.length; index += 50) {
    await db.batch(statements.slice(index, index + 50));
  }
}

function upsertStatement(movie: TheaterSourceMovie, checkedAt: number) {
  return getD1()
    .prepare(
      `INSERT INTO theater_movies
         (theater_code, theater_movie_id, title_ko, normalized_title,
          open_date, booking_available, checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(theater_code, theater_movie_id) DO UPDATE SET
         title_ko = excluded.title_ko,
         normalized_title = excluded.normalized_title,
         open_date = excluded.open_date,
         booking_available = excluded.booking_available,
         checked_at = excluded.checked_at`,
    )
    .bind(
      movie.theaterCode,
      movie.theaterMovieId,
      movie.titleKo,
      movie.normalizedTitle,
      movie.openDate,
      movie.bookingAvailable ? 1 : 0,
      checkedAt,
    );
}

async function syncOneTheater(code: TheaterCode) {
  const db = getD1();
  const now = Date.now();
  const token = crypto.randomUUID();
  if (!(await acquireLock(code, now, token))) {
    return { code, refreshed: false, reason: "fresh_or_running" as const };
  }

  try {
    const movies = await THEATER_SOURCE_LOADERS[code]();
    await runBatches(movies.map((movie) => upsertStatement(movie, now)));

    // 새 목록 저장이 성공한 뒤에만 이전 스냅샷을 지운다. 수집 실패 시 기존 값은 보존된다.
    await db
      .prepare("DELETE FROM theater_movies WHERE theater_code = ? AND checked_at < ?")
      .bind(code, now)
      .run();
    await db
      .prepare(
        `UPDATE sync_state
         SET last_success_at = ?, lock_until = 0, lock_token = NULL,
             status = 'idle', last_error = NULL, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(now, now, syncKey(code), token)
      .run();
    return { code, refreshed: true, count: movies.length };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";
    const failedAt = Date.now();
    await db
      .prepare(
        `UPDATE sync_state
         SET lock_until = ?, lock_token = NULL, status = 'error',
             last_error = ?, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(failedAt + SYNC_RETRY_COOLDOWN_MS, message, failedAt, syncKey(code), token)
      .run();
    return { code, refreshed: false, reason: "source_error" as const, error: message };
  }
}

export async function syncTheaterCatalog() {
  const results = await Promise.all(THEATER_CODES.map(syncOneTheater));
  return { results };
}

async function getPosterSyncState() {
  return getD1()
    .prepare(
      `SELECT sync_key, last_success_at, lock_until, lock_token, status
       FROM sync_state WHERE sync_key = ?`,
    )
    .bind(THEATER_POSTER_SYNC_KEY)
    .first<SyncRow>();
}

async function acquirePosterLock(now: number, token: string) {
  await getD1()
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
       WHERE sync_state.lock_until < ?`,
    )
    .bind(THEATER_POSTER_SYNC_KEY, now + THEATER_POSTER_LOCK_MS, token, now, now)
    .run();
  return (await getPosterSyncState())?.lock_token === token;
}

async function getTheaterPosterTargets(now: number) {
  const result = await getD1()
    .prepare(
      `WITH targets AS (
         SELECT normalized_title, MIN(title_ko) AS title_ko, MAX(open_date) AS open_date,
                MAX(kobis_movie_cd) AS kobis_movie_cd, MAX(checked_at) AS checked_at
         FROM theater_movies
         WHERE poster_url IS NULL
           -- 어느 작품인지 정하지 못한 제목은 기준 연도도 믿을 수 없다. "포스터 준비 중"으로 둔다.
           AND kobis_status <> 'ambiguous'
           AND (
             tmdb_status = 'pending'
             OR tmdb_updated_at IS NULL
             OR tmdb_updated_at <= ?
           )
         GROUP BY normalized_title
         ORDER BY MAX(checked_at) DESC, normalized_title ASC
         LIMIT ?
       )
       SELECT t.normalized_title, t.title_ko, t.open_date,
              -- 이 제목이 가리키는 작품을 수집이 정해 두었으면 그 작품의 연도를 쓴다.
              -- 같은 제목 작품이 movies 에 여러 편 있으면 MAX 가 다른 편의 연도를 집는다.
              COALESCE(
                (SELECT NULLIF(m.production_year, '') FROM movies AS m
                 WHERE m.movie_cd = t.kobis_movie_cd),
                (SELECT MAX(m.production_year) FROM movies AS m
                 WHERE m.normalized_title = t.normalized_title
                   AND m.production_year <> '')
              ) AS production_year
       FROM targets AS t
       ORDER BY t.checked_at DESC, t.normalized_title ASC`,
    )
    .bind(now - THEATER_POSTER_RETRY_MS, THEATER_POSTER_BATCH_LIMIT)
    .all<TheaterPosterTarget>();
  return result.results ?? [];
}

async function enrichTheaterPoster(target: TheaterPosterTarget, now: number) {
  const db = getD1();
  try {
    // 제목만 맞추면 같은 이름의 다른 작품이 붙는다(2026년 한국 영화 "인턴"에
    // 2015년 할리우드 "인턴" 포스터가 붙었다). 제목과 연도(±1년)가 함께 맞을
    // 때만 받아들인다. 기준 연도는 KOBIS 제작연도가 있으면 그것을 쓴다 —
    // 재개봉작도 KOBIS 에는 원래 제작연도가 있어 극장 개봉일보다 정확하다.
    const year = target.production_year || target.open_date?.slice(0, 4) || undefined;
    // "[응원상영]", "리마스터링" 같은 재상영 표시가 붙은 제목은 옛 작품일 수 있어,
    // 표시를 뗀 제목으로 연도 없이 한 번 더 찾는다. 이때도 제목은 정확히 일치해야 한다.
    const stripped = stripScreeningTags(target.title_ko);
    const match =
      (await findTmdbMatch(target.title_ko, year)) ??
      (stripped ? await findTmdbMatch(stripped) : null);
    if (!match) {
      await db
        .prepare(
          `UPDATE theater_movies
           SET tmdb_status = 'not_found', tmdb_updated_at = ?
           WHERE normalized_title = ?`,
        )
        .bind(now, target.normalized_title)
        .run();
      return "not_found" as const;
    }

    if (!match.posterUrl) {
      await db
        .prepare(
          `UPDATE theater_movies
           SET tmdb_status = 'not_found', tmdb_updated_at = ?
           WHERE normalized_title = ?`,
        )
        .bind(now, target.normalized_title)
        .run();
      return "not_found" as const;
    }

    await db
      .prepare(
        `UPDATE theater_movies
         SET poster_url = ?, tmdb_status = 'matched', tmdb_updated_at = ?
         WHERE normalized_title = ?`,
      )
      .bind(match.posterUrl, now, target.normalized_title)
      .run();
    return "matched" as const;
  } catch (error) {
    console.error(`Failed to enrich theater poster ${target.normalized_title}`, error);
    await db
      .prepare(
        `UPDATE theater_movies
         SET tmdb_status = 'error', tmdb_updated_at = ?
         WHERE normalized_title = ?`,
      )
      .bind(now, target.normalized_title)
      .run();
    return "error" as const;
  }
}

/**
 * 극장 카드 포스터를 방문자 요청과 분리해 D1에 미리 저장한다.
 * 새 스냅샷에 추가된 제목과 재시도 기한이 지난 제목만 TMDB에서 보강한다.
 */
export async function syncTheaterPosters() {
  const db = getD1();
  const now = Date.now();
  const token = crypto.randomUUID();
  if (!(await acquirePosterLock(now, token))) {
    return { refreshed: false, reason: "running" as const };
  }

  try {
    const targets = await getTheaterPosterTargets(now);
    const results: Array<"matched" | "not_found" | "error"> = [];
    const concurrency = 8;
    for (let index = 0; index < targets.length; index += concurrency) {
      results.push(
        ...(await Promise.all(
          targets.slice(index, index + concurrency).map((target) =>
            enrichTheaterPoster(target, now),
          ),
        )),
      );
    }

    await db
      .prepare(
        `UPDATE sync_state
         SET last_success_at = ?, lock_until = 0, lock_token = NULL,
             status = 'idle', last_error = NULL, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(now, now, THEATER_POSTER_SYNC_KEY, token)
      .run();

    return {
      refreshed: true,
      checked: targets.length,
      matched: results.filter((result) => result === "matched").length,
      notFound: results.filter((result) => result === "not_found").length,
      errors: results.filter((result) => result === "error").length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";
    const failedAt = Date.now();
    await db
      .prepare(
        `UPDATE sync_state
         SET lock_until = ?, lock_token = NULL, status = 'error',
             last_error = ?, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(
        failedAt + SYNC_RETRY_COOLDOWN_MS,
        message,
        failedAt,
        THEATER_POSTER_SYNC_KEY,
        token,
      )
      .run();
    throw error;
  }
}

type TheaterKobisTarget = {
  normalized_title: string;
  title_ko: string;
  open_date: string;
};

async function acquireKobisLock(now: number, token: string) {
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
       WHERE sync_state.lock_until < ?`,
    )
    .bind(THEATER_KOBIS_SYNC_KEY, now + THEATER_KOBIS_LOCK_MS, token, now, now)
    .run();
  const state = await db
    .prepare("SELECT lock_token FROM sync_state WHERE sync_key = ?")
    .bind(THEATER_KOBIS_SYNC_KEY)
    .first<{ lock_token: string | null }>();
  return state?.lock_token === token;
}

/**
 * 극장에는 걸려 있는데 movies에 대응 레코드가 없는 제목을 고른다.
 * 이런 제목의 카드는 상세 주소가 없어 검색 탭으로 보낼 수밖에 없다.
 *
 * 이 수집이 이어 준 제목('matched')과 애매하다고 본 제목('ambiguous')도 재시도
 * 기한이 지나면 다시 본다. 같은 제목 작품이 여러 편이면 처음 고른 편이 틀렸을 수
 * 있고(시간을 달리는 소녀: 극장은 2006년 애니, 우리는 2010년 실사에 이었다),
 * 극장 개봉일이 바뀌면 판단도 바뀐다. KOBIS 수집 창으로 채운 제목('pending')은
 * 그대로 건너뛴다.
 */
async function getTheaterKobisTargets(now: number) {
  const result = await getD1()
    .prepare(
      `SELECT tm.normalized_title,
              MIN(tm.title_ko) AS title_ko,
              MAX(tm.open_date) AS open_date
       FROM theater_movies AS tm
       WHERE (
               NOT EXISTS (
                 SELECT 1 FROM movies AS m
                 WHERE m.normalized_title = tm.normalized_title
               )
               OR tm.kobis_status IN ('matched', 'ambiguous')
             )
         AND (
               tm.kobis_status = 'pending'
               OR tm.kobis_updated_at IS NULL
               OR tm.kobis_updated_at <= ?
             )
       GROUP BY tm.normalized_title
       ORDER BY MAX(tm.checked_at) DESC, tm.normalized_title ASC
       LIMIT ?`,
    )
    .bind(now - THEATER_KOBIS_RETRY_MS, THEATER_KOBIS_BATCH_LIMIT)
    .all<TheaterKobisTarget>();
  return result.results ?? [];
}

/** 같은 제목 작품이 여러 편일 때, 극장 개봉일과 이만큼(년) 안에 드는 편만 같은 작품으로 본다. */
const KOBIS_YEAR_TOLERANCE = 1;

function kobisYear(movie: KobisMovieSummary) {
  if (/^\d{8}$/.test(movie.openDt)) return Number(movie.openDt.slice(0, 4));
  return /^\d{4}$/.test(movie.prdtYear) ? Number(movie.prdtYear) : null;
}

/**
 * 후보 중 채택할 KOBIS 레코드를 고른다.
 *
 * 정규화한 제목이 **정확히** 같은 것만 본다. 부분 일치를 허용하면 "괴물"이
 * "괴물들"을 물어오는 식의 오매칭이 생기고, 잘못 붙은 상세 페이지는 없는 것만
 * 못하다. (포스터 매칭이 findTmdbMatch에서 쓰는 것과 같은 원칙이다.)
 *
 * 같은 제목이 한 편뿐이면 그 편이다(오래된 작품의 재개봉도 여기에 든다).
 * 여러 편이면 극장이 알려준 개봉일과 ±1년 안에 드는 편 중 가장 가까운 편을 고른다.
 * 그런 편이 없으면 어느 작품인지 정할 수 없으므로 "ambiguous"를 돌려준다.
 * 가장 가까운 편을 억지로 고르면 시간을 달리는 소녀(2006 애니 재개봉)에
 * 2010년 실사판이 붙었다 — 잘못 붙은 상세보다 검색으로 보내는 편이 낫다.
 */
export function pickKobisMatch(
  candidates: KobisMovieSummary[],
  normalizedTitle: string,
  theaterOpenDate: string,
): KobisMovieSummary | "ambiguous" | null {
  const exact = candidates.filter(
    (movie) => normalizeTheaterTitle(movie.titleKo) === normalizedTitle,
  );
  if (!exact.length) return null;
  if (exact.length === 1) return exact[0];

  // 기준 날짜가 없으면 어느 편인지 가릴 근거가 없다.
  if (!/^\d{8}$/.test(theaterOpenDate)) return "ambiguous";
  const target = Number(theaterOpenDate);
  const targetYear = Number(theaterOpenDate.slice(0, 4));
  const near = exact.filter((movie) => {
    const year = kobisYear(movie);
    return year !== null && Math.abs(year - targetYear) <= KOBIS_YEAR_TOLERANCE;
  });
  if (!near.length) return "ambiguous";

  const distance = (candidate: KobisMovieSummary) =>
    /^\d{8}$/.test(candidate.openDt)
      ? Math.abs(Number(candidate.openDt) - target)
      : Number.MAX_SAFE_INTEGER;
  return near.reduce((best, movie) => (distance(movie) < distance(best) ? movie : best));
}

/** 평가 수로 고를 때, 1등이 최소 이만큼은 평가를 받아야 한다(표본이 적으면 우연이다). */
const POPULAR_MIN_VOTES = 50;
/** 평가 수로 고를 때, 1등이 2등의 몇 배 이상이어야 "압도적"으로 보는지. */
const POPULAR_DOMINANCE_RATIO = 3;

/**
 * 같은 제목 작품이 여러 편이고 극장 날짜로 가릴 수 없을 때(pickKobisMatch 가
 * "ambiguous"), TMDB 평가 수가 압도적으로 많은 편을 고른다. 재개봉은 대개 유명한
 * 편이다(시간을 달리는 소녀: 2006년 애니).
 *
 * 압도적이지 않거나, 그 편의 연도(±1년)에 해당하는 KOBIS 작품이 딱 한 편이 아니면
 * 고르지 않는다(null). 리메이크가 더 유명한데 원작이 특별상영되는 경우처럼, 억지로
 * 고르면 다시 남의 작품이 붙기 때문이다.
 */
export function pickByPopularity(
  candidates: KobisMovieSummary[],
  normalizedTitle: string,
  tmdbMatches: TmdbTitleCandidate[],
): { movie: KobisMovieSummary; tmdb: TmdbTitleCandidate } | null {
  const ranked = [...tmdbMatches].sort((a, b) => b.voteCount - a.voteCount);
  const [top, second] = ranked;
  if (!top || top.year === null || top.voteCount < POPULAR_MIN_VOTES) return null;
  if (top.voteCount < (second?.voteCount ?? 0) * POPULAR_DOMINANCE_RATIO) return null;

  const topYear = top.year;
  const near = candidates.filter((movie) => {
    if (normalizeTheaterTitle(movie.titleKo) !== normalizedTitle) return false;
    // KOBIS 는 국내 개봉이 늦은 작품이 많아 제작연도와 개봉연도를 둘 다 본다.
    const years = [movie.prdtYear, movie.openDt.slice(0, 4)]
      .filter((value) => /^\d{4}$/.test(value))
      .map(Number);
    return years.some((year) => Math.abs(year - topYear) <= KOBIS_YEAR_TOLERANCE);
  });
  return near.length === 1 ? { movie: near[0], tmdb: top } : null;
}

/** 이 제목이 가리키는 KOBIS 작품을 적는다. null 이면 지운다(어느 편인지 모름). */
function linkKobisMovie(normalizedTitle: string, movieCd: string | null) {
  return getD1()
    .prepare("UPDATE theater_movies SET kobis_movie_cd = ? WHERE normalized_title = ?")
    .bind(movieCd, normalizedTitle);
}

function markKobisStatus(normalizedTitle: string, status: string, now: number) {
  return getD1()
    .prepare(
      `UPDATE theater_movies
       SET kobis_status = ?, kobis_updated_at = ?
       WHERE normalized_title = ?`,
    )
    .bind(status, now, normalizedTitle);
}

/**
 * 채택한 KOBIS 레코드를 movies에 넣는다.
 * lib/release-catalog.ts의 upsertMovieStatement와 같은 모양이지만, 두 모듈이
 * 서로를 import하면 순환이 되어 여기서 따로 만든다. 한쪽을 고치면 다른 쪽도 본다.
 */
function upsertMatchedMovie(movie: KobisMovieSummary, now: number) {
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

async function matchOneTheaterTitle(target: TheaterKobisTarget, now: number) {
  const db = getD1();
  try {
    const candidates = await listKobisMoviesByTitle(target.title_ko);
    const match = pickKobisMatch(candidates, target.normalized_title, target.open_date);
    if (!match) {
      await markKobisStatus(target.normalized_title, "not_found", now).run();
      return "not_found" as const;
    }

    if (match !== "ambiguous") {
      await db.batch([
        upsertMatchedMovie(match, now),
        markKobisStatus(target.normalized_title, "matched", now),
        linkKobisMovie(target.normalized_title, match.movieCd),
      ]);
      return "matched" as const;
    }

    // 극장 날짜로는 가릴 수 없다. 평가 수가 압도적인 편이 있으면 그 편으로 잇고,
    // 그 편의 TMDB 포스터를 바로 쓴다.
    const popular = pickByPopularity(
      candidates,
      target.normalized_title,
      await listTmdbExactTitleMatches(target.title_ko),
    );
    if (popular) {
      await db.batch([
        upsertMatchedMovie(popular.movie, now),
        // 상세가 같은 TMDB 작품을 바로 찾게 id 만 적는다. 제공처는 확인하지 않았으므로
        // 'matched' 가 아닌 id_only 상태를 쓴다.
        db
          .prepare(
            `UPDATE movies SET tmdb_id = ?, tmdb_status = ?, tmdb_updated_at = ?
             WHERE movie_cd = ? AND tmdb_id IS NULL`,
          )
          .bind(popular.tmdb.id, TMDB_ID_ONLY_STATUS, now, popular.movie.movieCd),
        markKobisStatus(target.normalized_title, "matched", now),
        linkKobisMovie(target.normalized_title, popular.movie.movieCd),
        db
          .prepare(
            `UPDATE theater_movies
             SET poster_url = ?, tmdb_status = ?, tmdb_updated_at = ?
             WHERE normalized_title = ?`,
          )
          .bind(
            popular.tmdb.posterUrl,
            popular.tmdb.posterUrl ? "matched" : "pending",
            popular.tmdb.posterUrl ? now : null,
            target.normalized_title,
          ),
      ]);
      return "matched" as const;
    }

    // 끝내 정하지 못했다. movies에 이미 들어 있는 같은 제목 작품은 지우지 않는다
    // (그 작품의 상세는 맞다). 목록 카드가 그 작품에 잇지 않도록 상태만 남기고,
    // 그 작품 연도로 찾았을 수 있는 TMDB 포스터도 비운다("포스터 준비 중").
    await db.batch([
      markKobisStatus(target.normalized_title, "ambiguous", now),
      linkKobisMovie(target.normalized_title, null),
      db
        .prepare(
          `UPDATE theater_movies
           SET poster_url = NULL, tmdb_status = 'pending', tmdb_updated_at = NULL
           WHERE normalized_title = ?`,
        )
        .bind(target.normalized_title),
    ]);
    return "ambiguous" as const;
  } catch (error) {
    console.error(`Failed to match theater title ${target.normalized_title}`, error);
    // 다시 확인하다 실패한 제목('matched'·'ambiguous')은 앞선 판단을 그대로 둔다.
    // 'error' 로 덮으면 애매한 제목이 다시 같은 제목 작품에 이어져 남의 포스터가 뜬다.
    await getD1()
      .prepare(
        `UPDATE theater_movies
         SET kobis_status = CASE WHEN kobis_status IN ('matched', 'ambiguous')
                                 THEN kobis_status ELSE 'error' END,
             kobis_updated_at = ?
         WHERE normalized_title = ?`,
      )
      .bind(now, target.normalized_title)
      .run();
    return "error" as const;
  }
}

/**
 * 극장 상영작 중 KOBIS 레코드가 없는 제목을 찾아 movies에 채운다.
 *
 * 1탭 목록은 극장 3사에서 오는데 movies는 KOBIS를 오늘 기준 -60일~+120일
 * 창으로만 채운다. 그 창 밖의 작품(재개봉·특별상영 등)은 조인할 레코드가 없어
 * 상세 페이지로 넘어가지 못했다. 이 수집이 그 간극을 메운다.
 */
export async function syncTheaterKobisMatches() {
  const db = getD1();
  const now = Date.now();
  const token = crypto.randomUUID();
  if (!(await acquireKobisLock(now, token))) {
    return { refreshed: false, reason: "running" as const };
  }

  try {
    const targets = await getTheaterKobisTargets(now);
    const results: Array<"matched" | "ambiguous" | "not_found" | "error"> = [];
    // KOBIS는 응답이 느린 편이라 동시 실행을 낮게 잡는다.
    const concurrency = 4;
    for (let index = 0; index < targets.length; index += concurrency) {
      results.push(
        ...(await Promise.all(
          targets.slice(index, index + concurrency).map((target) =>
            matchOneTheaterTitle(target, now),
          ),
        )),
      );
    }

    await db
      .prepare(
        `UPDATE sync_state
         SET last_success_at = ?, lock_until = 0, lock_token = NULL,
             status = 'idle', last_error = NULL, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(now, now, THEATER_KOBIS_SYNC_KEY, token)
      .run();

    return {
      refreshed: true,
      checked: targets.length,
      matched: results.filter((result) => result === "matched").length,
      ambiguous: results.filter((result) => result === "ambiguous").length,
      notFound: results.filter((result) => result === "not_found").length,
      errors: results.filter((result) => result === "error").length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";
    const failedAt = Date.now();
    await db
      .prepare(
        `UPDATE sync_state
         SET lock_until = ?, lock_token = NULL, status = 'error',
             last_error = ?, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(
        failedAt + SYNC_RETRY_COOLDOWN_MS,
        message,
        failedAt,
        THEATER_KOBIS_SYNC_KEY,
        token,
      )
      .run();
    throw error;
  }
}

type TheaterTmdbTarget = {
  movie_cd: string;
  title_ko: string;
  production_year: string;
  title_en: string;
};

async function acquireTmdbIdLock(now: number, token: string) {
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
       WHERE sync_state.lock_until < ?`,
    )
    .bind(THEATER_TMDB_SYNC_KEY, now + THEATER_TMDB_LOCK_MS, token, now, now)
    .run();
  const state = await db
    .prepare("SELECT lock_token FROM sync_state WHERE sync_key = ?")
    .bind(THEATER_TMDB_SYNC_KEY)
    .first<{ lock_token: string | null }>();
  return state?.lock_token === token;
}

/**
 * 지금 극장에 걸려 있는데 TMDB id를 아직 모르는 작품을 고른다.
 * 한 번도 시도하지 않은 것을 먼저, 그다음 개봉일이 최근인 순으로 본다.
 * 그러지 않으면 끝내 매칭되지 않는 작품들이 매번 배치를 차지해 새 작품이 밀린다.
 */
async function getTheaterTmdbTargets(now: number) {
  const result = await getD1()
    .prepare(
      `SELECT m.movie_cd, m.title_ko, m.production_year, m.title_en
       FROM movies AS m
       WHERE m.tmdb_id IS NULL
         AND EXISTS (
               SELECT 1 FROM theater_movies AS tm
               WHERE tm.normalized_title = m.normalized_title
             )
         AND (m.tmdb_updated_at IS NULL OR m.tmdb_updated_at <= ?)
       ORDER BY m.tmdb_updated_at IS NOT NULL, m.open_date DESC
       LIMIT ?`,
    )
    .bind(now - THEATER_TMDB_RETRY_MS, THEATER_TMDB_BATCH_LIMIT)
    .all<TheaterTmdbTarget>();
  return result.results ?? [];
}

async function storeTmdbId(target: TheaterTmdbTarget, now: number) {
  const db = getD1();
  try {
    // 포스터 매칭과 달리 연도를 함께 넘긴다. 상세 페이지의 평점·줄거리·제공처가
    // 이 id를 따라가므로, 같은 제목의 리메이크를 집으면 남의 작품 정보가 뜬다.
    const match = await findTmdbMatch(
      target.title_ko,
      target.production_year,
      target.title_en,
    );
    if (!match) {
      await db
        .prepare(
          `UPDATE movies SET tmdb_status = ?, tmdb_updated_at = ?
           WHERE movie_cd = ? AND tmdb_id IS NULL`,
        )
        .bind(TMDB_ID_NOT_FOUND_STATUS, now, target.movie_cd)
        .run();
      return "not_found" as const;
    }

    // 포스터·평점은 일부러 건드리지 않는다. 그것까지 쓰면 목록 카드의 겉모습이
    // 바뀐다. 여기서 필요한 건 상세 진입을 빠르게 할 id 하나뿐이다.
    await db
      .prepare(
        `UPDATE movies SET tmdb_id = ?, tmdb_status = ?, tmdb_updated_at = ?
         WHERE movie_cd = ? AND tmdb_id IS NULL`,
      )
      .bind(match.id, TMDB_ID_ONLY_STATUS, now, target.movie_cd)
      .run();
    return "matched" as const;
  } catch (error) {
    console.error(`Failed to store TMDB id for ${target.movie_cd}`, error);
    await db
      .prepare(
        `UPDATE movies SET tmdb_status = ?, tmdb_updated_at = ?
         WHERE movie_cd = ? AND tmdb_id IS NULL`,
      )
      .bind(TMDB_ID_ERROR_STATUS, now, target.movie_cd)
      .run();
    return "error" as const;
  }
}

/**
 * 극장에 걸린 작품의 TMDB id를 미리 채운다.
 *
 * 상세 페이지는 id를 알면 TMDB 조회를 바로 시작하지만, 모르면 제목으로 먼저
 * 찾아야 해서 느린 왕복이 한 번 더 붙는다. 그 왕복을 방문자가 아니라 수집이
 * 대신 치른다. 제공처까지 저장하지는 않으므로 tmdb_status는 캐시가 신뢰하는
 * 값('matched')을 쓰지 않는다 — 확인한 적 없는 제공처를 단정하면 안 된다.
 */
export async function syncTheaterMovieTmdbIds() {
  const db = getD1();
  const now = Date.now();
  const token = crypto.randomUUID();
  if (!(await acquireTmdbIdLock(now, token))) {
    return { refreshed: false, reason: "running" as const };
  }

  try {
    const targets = await getTheaterTmdbTargets(now);
    const results: Array<"matched" | "not_found" | "error"> = [];
    const concurrency = 8;
    for (let index = 0; index < targets.length; index += concurrency) {
      results.push(
        ...(await Promise.all(
          targets.slice(index, index + concurrency).map((target) =>
            storeTmdbId(target, now),
          ),
        )),
      );
    }

    await db
      .prepare(
        `UPDATE sync_state
         SET last_success_at = ?, lock_until = 0, lock_token = NULL,
             status = 'idle', last_error = NULL, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(now, now, THEATER_TMDB_SYNC_KEY, token)
      .run();

    return {
      refreshed: true,
      checked: targets.length,
      matched: results.filter((result) => result === "matched").length,
      notFound: results.filter((result) => result === "not_found").length,
      errors: results.filter((result) => result === "error").length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";
    const failedAt = Date.now();
    await db
      .prepare(
        `UPDATE sync_state
         SET lock_until = ?, lock_token = NULL, status = 'error',
             last_error = ?, updated_at = ?
         WHERE sync_key = ? AND lock_token = ?`,
      )
      .bind(failedAt + SYNC_RETRY_COOLDOWN_MS, message, failedAt, THEATER_TMDB_SYNC_KEY, token)
      .run();
    throw error;
  }
}

/**
 * 상세 화면의 극장별 상영 여부. movieCd 를 넘기면, 극장에 걸린 같은 제목이 다른
 * 작품을 가리킬 때(같은 제목의 리메이크 등) 이 작품은 상영 중이 아닌 것으로 본다.
 */
export async function getTheaterStatuses(title: string, movieCd?: string) {
  const normalizedTitle = normalizeTheaterTitle(title);
  const fallback = {
    initialized: false,
    statuses: THEATER_CODES.map((code) => ({
      code,
      availability: "unknown" as const,
      bookingAvailable: false,
    })),
  };
  if (!normalizedTitle) return fallback;

  try {
    const db = getD1();
    const placeholders = THEATER_CODES.map(() => "?").join(",");
    const [movieResult, stateResult] = await Promise.all([
      db
        .prepare(
          `SELECT theater_code, normalized_title, booking_available, kobis_status, kobis_movie_cd
           FROM theater_movies WHERE normalized_title = ?`,
        )
        .bind(normalizedTitle)
        .all<TheaterRow>(),
      db
        .prepare(
          `SELECT sync_key, last_success_at, lock_token, status
           FROM sync_state WHERE sync_key IN (${placeholders})`,
        )
        .bind(...THEATER_CODES.map(syncKey))
        .all<SyncRow>(),
    ]);

    const rows = movieResult.results ?? [];
    const states = new Map((stateResult.results ?? []).map((row) => [row.sync_key, row]));
    const now = Date.now();
    const initialized = THEATER_CODES.some((code) => states.has(syncKey(code)));

    return {
      initialized,
      statuses: THEATER_CODES.map((code): TheaterStatus => {
        const row = rows.find(
          (item) =>
            item.theater_code === code &&
            !(movieCd && item.kobis_movie_cd && item.kobis_movie_cd !== movieCd),
        );
        const state = states.get(syncKey(code));
        const isFresh = Boolean(
          state?.last_success_at && now - state.last_success_at < THEATER_SYNC_INTERVAL_MS * 2,
        );
        // 같은 제목의 다른 작품이 걸려 있을 수 있다. 이 작품이 상영 중이라고 단정하지 않는다.
        if (row?.kobis_status === "ambiguous") {
          return { code, availability: "unknown", bookingAvailable: false };
        }
        if (row) {
          return {
            code,
            availability:
              isFresh && state?.status !== "error" ? "confirmed" : "unknown",
            bookingAvailable: Boolean(row.booking_available),
          };
        }
        return {
          code,
          availability: isFresh && state?.status !== "error" ? "unavailable" : "unknown",
          bookingAvailable: false,
        };
      }),
    };
  } catch (error) {
    console.error("Failed to read theater status", error);
    return fallback;
  }
}

/**
 * 제목별로 상영이 확인된 극장사를 돌려준다.
 *
 * 같은 제목 작품이 여러 편이라 어느 편인지 모르는 제목('ambiguous')은 기본으로 뺀다.
 * 검색 결과에서 그 제목의 모든 작품에 극장 표시가 붙지 않게 하기 위해서다. 극장
 * 목록 카드처럼 "극장에 걸린 그 제목" 자체를 보여줄 때만 includeAmbiguous 를 켠다.
 */
export async function getConfirmedTheatersByTitle(
  titles: string[],
  { includeAmbiguous = false }: { includeAmbiguous?: boolean } = {},
) {
  const normalized = Array.from(new Set(titles.map(normalizeTheaterTitle).filter(Boolean)));
  const result = new Map<string, TheaterCode[]>();
  if (!normalized.length) return result;

  try {
    const placeholders = normalized.map(() => "?").join(",");
    const freshnessThreshold = Date.now() - THEATER_SYNC_INTERVAL_MS * 2;
    const rows = await getD1()
      .prepare(
        `SELECT tm.theater_code, tm.normalized_title, tm.booking_available
         FROM theater_movies AS tm
         INNER JOIN sync_state AS ss
           ON ss.sync_key = 'theater:' || tm.theater_code
         WHERE tm.normalized_title IN (${placeholders})
           ${includeAmbiguous ? "" : "AND tm.kobis_status <> 'ambiguous'"}
           AND ss.last_success_at >= ?
           AND ss.status != 'error'`,
      )
      .bind(...normalized, freshnessThreshold)
      .all<TheaterRow>();
    for (const row of rows.results ?? []) {
      const current = result.get(row.normalized_title) ?? [];
      if (!current.includes(row.theater_code)) current.push(row.theater_code);
      result.set(row.normalized_title, current);
    }
  } catch (error) {
    console.error("Failed to read theater matches", error);
  }
  return result;
}

export async function getLatestTheaterRefresh() {
  try {
    const keys = [...THEATER_CODES.map(syncKey), THEATER_POSTER_SYNC_KEY];
    const placeholders = keys.map(() => "?").join(",");
    const rows = await getD1()
      .prepare(
        `SELECT sync_key, last_success_at, lock_token, status
         FROM sync_state WHERE sync_key IN (${placeholders})`,
      )
      .bind(...keys)
      .all<SyncRow>();
    const states = rows.results ?? [];
    const theaterStates = states.filter((row) => row.sync_key.startsWith("theater:"));
    const posterState = states.find((row) => row.sync_key === THEATER_POSTER_SYNC_KEY);
    const successes = theaterStates
      .map((row) => row.last_success_at)
      .filter((value): value is number => typeof value === "number");
    return {
      lastSuccessAt: successes.length ? Math.min(...successes) : null,
      stale:
        successes.length !== THEATER_CODES.length ||
        theaterStates.some((row) => row.status === "error") ||
        Date.now() - Math.min(...successes) >= THEATER_SYNC_INTERVAL_MS ||
        !posterState?.last_success_at ||
        posterState.status === "error",
    };
  } catch {
    return { lastSuccessAt: null, stale: true };
  }
}
