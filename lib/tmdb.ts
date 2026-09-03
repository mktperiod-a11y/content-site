// TMDB(The Movie Database) API 클라이언트.
// 서버 전용 모듈입니다 — TMDB_API_KEY가 클라이언트 번들에 포함되지 않도록
// Route Handler / Server Component에서만 import 하세요 (client component에서 import 금지).
//
// 이용약관: TMDB 데이터를 노출하는 화면에는 출처 표기가 필수입니다.
// (components/tmdb-attribution.tsx 참고)

// 기본값은 실제 TMDB. TMDB_API_BASE로 로컬 목 서버를 가리키면 네트워크 없이
// 화면을 검증할 수 있다 (개발/테스트 용도).
const TMDB_BASE = process.env.TMDB_API_BASE || "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = process.env.TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p";
const REQUEST_TIMEOUT_MS = 8000;

export class TmdbApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TmdbApiError";
  }
}

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new TmdbApiError("TMDB_API_KEY가 설정되지 않았어요.");
  }
  return key;
}

async function fetchTmdbJson(path: string, params: Record<string, string> = {}) {
  const key = getApiKey();
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", key);
  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // 제공처 정보는 자주 바뀌므로 오래 캐시하지 않는다.
      next: { revalidate: 60 * 60 },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new TmdbApiError("TMDB 응답이 지연되고 있어요.");
    }
    throw new TmdbApiError("TMDB API에 연결할 수 없어요.");
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new TmdbApiError(`TMDB API 오류 (HTTP ${response.status})`);
  }

  try {
    return await response.json();
  } catch {
    throw new TmdbApiError("TMDB 응답을 해석할 수 없어요.");
  }
}

export function tmdbImageUrl(path: string | null | undefined, size: string) {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// --- 간단한 인메모리 캐시 ---
// 검색 결과 목록에 제공처 칩을 붙이려면 작품마다 TMDB를 조회해야 해서 호출량이
// 빠르게 늘어난다. 인기작은 반복 조회되므로 캐시 적중률이 높다.
// (워커 인스턴스 단위의 best-effort 캐시이며, 영속 저장소가 아니다.)

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

async function withCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memoryCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  const value = await load();

  if (memoryCache.size >= CACHE_MAX_ENTRIES) {
    // 가장 오래된 항목부터 제거 (Map은 삽입 순서를 유지한다)
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey !== undefined) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** 제목 비교용 정규화 (공백·문장부호 제거) */
function normalizeTitle(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s,.:;!?'"“”·\-_/()[\]]/g, "")
    .toLowerCase();
}

type TmdbSearchResult = {
  id: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
};

export type TmdbMatch = {
  id: number;
  /** 검색 응답에 포함된 포스터 (별도 상세 조회 없이 목록에서 바로 쓴다) */
  posterUrl: string | null;
  voteAverage: number;
  voteCount: number;
};

export type TmdbMovie = {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number;
  voteCount: number;
  releaseDate: string;
};

/**
 * KOBIS 작품을 TMDB에 매칭한다.
 *
 * 기획 원칙(6-2)에 따라 불확실한 매칭은 연결하지 않는다:
 * 제목(한국어/원제/영문)이 정규화 후 정확히 일치하고, 개봉연도가 ±1년 이내인
 * 결과만 채택한다. 조건을 만족하는 결과가 없으면 null을 반환한다.
 */
export async function findTmdbMatch(
  titleKo: string,
  year?: string,
  titleEn?: string,
): Promise<TmdbMatch | null> {
  return withCache(`match:${titleKo}:${year ?? ""}:${titleEn ?? ""}`, async () => {
    const json = (await fetchTmdbJson("/search/movie", {
      query: titleKo,
      language: "ko-KR",
      include_adult: "false",
    })) as { results?: TmdbSearchResult[] } | null;

    const results = json?.results ?? [];
    if (!results.length) return null;

    const wantedTitles = [titleKo, titleEn]
      .filter(Boolean)
      .map((t) => normalizeTitle(t as string));
    const wantedYear = year ? Number(year) : null;

    for (const result of results) {
      const candidateTitles = [result.title, result.original_title]
        .filter(Boolean)
        .map((t) => normalizeTitle(t as string));

      const titleMatches = candidateTitles.some((candidate) =>
        wantedTitles.some((wanted) => candidate === wanted),
      );
      if (!titleMatches) continue;

      if (wantedYear) {
        const resultYear = Number((result.release_date ?? "").slice(0, 4));
        if (!resultYear || Math.abs(resultYear - wantedYear) > 1) continue;
      }

      return {
        id: result.id,
        posterUrl: tmdbImageUrl(result.poster_path, "w342"),
        voteAverage: result.vote_average ?? 0,
        voteCount: result.vote_count ?? 0,
      };
    }

    return null;
  });
}

export async function getTmdbMovie(tmdbId: number): Promise<TmdbMovie | null> {
  const json = (await fetchTmdbJson(`/movie/${tmdbId}`, { language: "ko-KR" })) as {
    id: number;
    title?: string;
    original_title?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    vote_count?: number;
    release_date?: string;
  } | null;

  if (!json) return null;

  return {
    id: json.id,
    title: json.title ?? "",
    originalTitle: json.original_title ?? "",
    overview: json.overview ?? "",
    posterUrl: tmdbImageUrl(json.poster_path, "w500"),
    backdropUrl: tmdbImageUrl(json.backdrop_path, "w1280"),
    voteAverage: json.vote_average ?? 0,
    voteCount: json.vote_count ?? 0,
    releaseDate: json.release_date ?? "",
  };
}

export type WatchProvider = {
  providerId: number;
  name: string;
  logoUrl: string | null;
};

export type WatchProvidersKR = {
  /** JustWatch 제공 페이지 링크 (출처 표기 조건상 함께 노출) */
  link: string;
  subscription: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
};

type RawProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

function mapProviders(list: RawProvider[] | undefined): WatchProvider[] {
  return (list ?? []).map((provider) => ({
    providerId: provider.provider_id,
    name: provider.provider_name,
    logoUrl: tmdbImageUrl(provider.logo_path, "w92"),
  }));
}

/**
 * 국내(KR) 제공처 정보. TMDB의 watch/providers는 JustWatch가 원출처이며,
 * 노출 시 JustWatch 출처 표기와 링크를 함께 제공해야 한다.
 */
export async function getTmdbWatchProvidersKR(
  tmdbId: number,
): Promise<WatchProvidersKR | null> {
  return withCache(`providers:${tmdbId}`, async () => {
    const json = (await fetchTmdbJson(`/movie/${tmdbId}/watch/providers`)) as {
      results?: Record<
        string,
        { link?: string; flatrate?: RawProvider[]; rent?: RawProvider[]; buy?: RawProvider[] }
      >;
    } | null;

    const kr = json?.results?.KR;
    if (!kr) return null;

    return {
      link: kr.link ?? "",
      subscription: mapProviders(kr.flatrate),
      rent: mapProviders(kr.rent),
      buy: mapProviders(kr.buy),
    };
  });
}

export type TmdbReview = {
  id: string;
  author: string;
  content: string;
  rating: number | null;
  createdAt: string;
  url: string;
};

/**
 * TMDB 사용자 리뷰. 없으면 빈 배열을 반환한다 —
 * 리뷰가 없는 작품에 가짜 리뷰를 만들지 않는다(기획 원칙 6-3).
 */
export async function getTmdbReviews(tmdbId: number): Promise<TmdbReview[]> {
  const json = (await fetchTmdbJson(`/movie/${tmdbId}/reviews`, {
    language: "ko-KR",
  })) as {
    results?: Array<{
      id: string;
      author?: string;
      content?: string;
      created_at?: string;
      url?: string;
      author_details?: { rating?: number | null };
    }>;
  } | null;

  return (json?.results ?? []).map((review) => ({
    id: review.id,
    author: review.author ?? "익명",
    content: review.content ?? "",
    rating: review.author_details?.rating ?? null,
    createdAt: review.created_at ?? "",
    url: review.url ?? "",
  }));
}

/** 평가 수가 이 값 미만이면 평점을 크게 강조하지 않는다(기획 원칙 6-3). */
export const LOW_VOTE_COUNT_THRESHOLD = 50;
