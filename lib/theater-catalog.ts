import { getD1 } from "@/db";
import {
  THEATER_CODES,
  THEATER_SOURCE_LOADERS,
  normalizeTheaterTitle,
  type TheaterCode,
  type TheaterSourceMovie,
} from "@/lib/theater-sources";

export const THEATER_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const THEATER_LOCK_MS = 5 * 60 * 1000;
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
  lock_token: string | null;
  status: string;
};

type TheaterRow = {
  theater_code: TheaterCode;
  normalized_title: string;
  booking_available: number;
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

export async function getTheaterStatuses(title: string) {
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
          `SELECT theater_code, normalized_title, booking_available
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
        const row = rows.find((item) => item.theater_code === code);
        const state = states.get(syncKey(code));
        const isFresh = Boolean(
          state?.last_success_at && now - state.last_success_at < THEATER_SYNC_INTERVAL_MS * 2,
        );
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

export async function getConfirmedTheatersByTitle(titles: string[]) {
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
    const placeholders = THEATER_CODES.map(() => "?").join(",");
    const rows = await getD1()
      .prepare(
        `SELECT sync_key, last_success_at, lock_token, status
         FROM sync_state WHERE sync_key IN (${placeholders})`,
      )
      .bind(...THEATER_CODES.map(syncKey))
      .all<SyncRow>();
    const successes = (rows.results ?? [])
      .map((row) => row.last_success_at)
      .filter((value): value is number => typeof value === "number");
    return {
      lastSuccessAt: successes.length ? Math.min(...successes) : null,
      stale:
        successes.length !== THEATER_CODES.length ||
        (rows.results ?? []).some((row) => row.status === "error") ||
        Date.now() - Math.min(...successes) >= THEATER_SYNC_INTERVAL_MS,
    };
  } catch {
    return { lastSuccessAt: null, stale: true };
  }
}
