// 서버 전용 모듈입니다 — 상세 화면이 받은 외부 응답을 D1 에 보관하고 다시 씁니다.
import { cache } from "react";

import { getD1 } from "@/db";

/** KOBIS 작품 정보는 거의 바뀌지 않는다. */
export const KOBIS_DETAIL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** OTT 제공처는 하루 안에도 바뀔 수 있어 매일 새로 받는다(수집기는 하루 한 번). */
export const TMDB_DETAIL_MAX_AGE_MS = 36 * 60 * 60 * 1000;
/** D1 한 문장 크기 한도(100KB)보다 넉넉히 작게 잡는다. 넘으면 보관하지 않는다. */
const MAX_JSON_LENGTH = 90_000;

type DetailCacheRow = {
  kobis_json: string | null;
  kobis_fetched_at: number | null;
  tmdb_id: number | null;
  tmdb_json: string | null;
  tmdb_fetched_at: number | null;
};

/** 한 요청 안에서 KOBIS·TMDB 두 곳이 같은 행을 읽으므로 한 번만 묻는다. */
const readRow = cache(async (movieCd: string): Promise<DetailCacheRow | null> => {
  try {
    return await getD1()
      .prepare(
        `SELECT kobis_json, kobis_fetched_at, tmdb_id, tmdb_json, tmdb_fetched_at
         FROM detail_cache WHERE movie_cd = ?`,
      )
      .bind(movieCd)
      .first<DetailCacheRow>();
  } catch {
    // 보관함이 없거나 읽지 못해도 화면은 지금처럼 외부에서 받아 그린다.
    return null;
  }
});

function parseFresh<T>(json: string | null, fetchedAt: number | null, maxAgeMs: number): T | null {
  if (!json || !fetchedAt || Date.now() - fetchedAt > maxAgeMs) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export async function readFreshKobisDetail<T>(movieCd: string): Promise<T | null> {
  const row = await readRow(movieCd);
  return row ? parseFresh<T>(row.kobis_json, row.kobis_fetched_at, KOBIS_DETAIL_MAX_AGE_MS) : null;
}

/** 저장된 TMDB 응답이 지금 매칭된 작품의 것일 때만 돌려준다. */
export async function readFreshTmdbDetail<T>(movieCd: string, tmdbId: number): Promise<T | null> {
  const row = await readRow(movieCd);
  if (!row || row.tmdb_id !== tmdbId) return null;
  return parseFresh<T>(row.tmdb_json, row.tmdb_fetched_at, TMDB_DETAIL_MAX_AGE_MS);
}

export async function saveKobisDetail(movieCd: string, data: unknown) {
  const json = JSON.stringify(data);
  if (json.length > MAX_JSON_LENGTH) return;
  try {
    await getD1()
      .prepare(
        `INSERT INTO detail_cache (movie_cd, kobis_json, kobis_fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(movie_cd) DO UPDATE SET
           kobis_json = excluded.kobis_json, kobis_fetched_at = excluded.kobis_fetched_at`,
      )
      .bind(movieCd, json, Date.now())
      .run();
  } catch (error) {
    console.error("상세 KOBIS 응답 보관 실패", error);
  }
}

export async function saveTmdbDetail(movieCd: string, tmdbId: number, data: unknown) {
  const json = JSON.stringify(data);
  if (json.length > MAX_JSON_LENGTH) return;
  try {
    await getD1()
      .prepare(
        `INSERT INTO detail_cache (movie_cd, tmdb_id, tmdb_json, tmdb_fetched_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(movie_cd) DO UPDATE SET
           tmdb_id = excluded.tmdb_id, tmdb_json = excluded.tmdb_json,
           tmdb_fetched_at = excluded.tmdb_fetched_at`,
      )
      .bind(movieCd, tmdbId, json, Date.now())
      .run();
  } catch (error) {
    console.error("상세 TMDB 응답 보관 실패", error);
  }
}
