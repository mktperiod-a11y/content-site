import type { KobisMovieSummary } from "@/lib/kobis";

/** 자동완성과 검색 제출 모두 이 길이부터 동작한다. */
export const MIN_SEARCH_LENGTH = 2;

/** 자모·이모지까지 한 글자로 세도록 코드 포인트 기준으로 확인한다. */
export function isSearchable(term: string) {
  return Array.from(term.trim()).length >= MIN_SEARCH_LENGTH;
}

export async function fetchMovieSearch(query: string, limit: number, signal: AbortSignal) {
  const url = new URL("/api/movies/search", window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { signal });
  const body = (await response.json()) as { movies?: KobisMovieSummary[]; error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "검색 중 오류가 발생했어요.");
  }
  return body.movies ?? [];
}

