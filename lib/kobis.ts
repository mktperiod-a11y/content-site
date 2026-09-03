// KOBIS(영화진흥위원회 영화관입장권통합전산망) Open API 클라이언트.
// 서버 전용 모듈입니다 — KOBIS_API_KEY는 절대 클라이언트 번들에 포함되지 않도록
// 이 파일을 Route Handler / Server Component에서만 import 하세요 (client component에서 import 금지).

// 기본값은 실제 KOBIS. KOBIS_API_BASE로 로컬 목 서버를 가리키면 네트워크 없이
// 화면을 검증할 수 있다 (개발/테스트 용도).
const KOBIS_BASE =
  process.env.KOBIS_API_BASE || "https://www.kobis.or.kr/kobisopenapi/webservice/rest";
const REQUEST_TIMEOUT_MS = 8000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 300;

const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();
const pendingRequests = new Map<string, Promise<unknown>>();

async function withCache<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = memoryCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const pending = pendingRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      if (memoryCache.size >= CACHE_MAX_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        if (oldestKey !== undefined) memoryCache.delete(oldestKey);
      }
      memoryCache.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    })
    .finally(() => pendingRequests.delete(key));

  pendingRequests.set(key, request);
  return request;
}

export class KobisApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KobisApiError";
  }
}

function getApiKey() {
  const key = process.env.KOBIS_API_KEY;
  if (!key) {
    throw new KobisApiError("KOBIS_API_KEY가 설정되지 않았어요.");
  }
  return key;
}

async function fetchKobisJson(path: string, params: Record<string, string>) {
  const key = getApiKey();
  const url = new URL(`${KOBIS_BASE}/${path}`);
  url.searchParams.set("key", key);
  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // KOBIS 목록은 자주 갱신되므로 캐시하지 않는다.
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new KobisApiError("KOBIS 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.");
    }
    throw new KobisApiError("KOBIS API에 연결할 수 없어요.");
  }

  if (!response.ok) {
    throw new KobisApiError(`KOBIS API 오류 (HTTP ${response.status})`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new KobisApiError("KOBIS 응답을 해석할 수 없어요.");
  }

  if (json && typeof json === "object" && "faultInfo" in json) {
    const fault = (json as { faultInfo?: { message?: string } }).faultInfo;
    throw new KobisApiError(fault?.message ?? "KOBIS API 요청이 거부됐어요.");
  }

  return json;
}

export type KobisMovieSummary = {
  movieCd: string;
  titleKo: string;
  titleEn: string;
  prdtYear: string;
  openDt: string;
  genreAlt: string;
  nationAlt: string;
  directors: string[];
};

type SearchMovieListResponse = {
  movieListResult?: {
    movieList?: Array<{
      movieCd: string;
      movieNm: string;
      movieNmEn?: string;
      prdtYear?: string;
      openDt?: string;
      genreAlt?: string;
      nationAlt?: string;
      directors?: Array<{ peopleNm: string }>;
    }>;
  };
};

export async function searchKobisMovies(
  query: string,
  limit = 20,
): Promise<KobisMovieSummary[]> {
  const trimmed = query.normalize("NFKC").trim();
  if (!trimmed) return [];

  const safeLimit = Math.min(Math.max(limit, 1), 30);
  const cacheKey = `search:${trimmed.toLowerCase()}:${safeLimit}`;

  return withCache(cacheKey, SEARCH_CACHE_TTL_MS, async () => {
    async function searchBy(field: "movieNm" | "directorNm") {
      const json = (await fetchKobisJson("movie/searchMovieList.json", {
        [field]: trimmed,
        itemPerPage: String(safeLimit),
      })) as SearchMovieListResponse;

      return (json.movieListResult?.movieList ?? []).map((item) => ({
        movieCd: item.movieCd,
        titleKo: item.movieNm,
        titleEn: item.movieNmEn ?? "",
        prdtYear: item.prdtYear ?? "",
        openDt: item.openDt ?? "",
        genreAlt: item.genreAlt ?? "",
        nationAlt: item.nationAlt ?? "",
        directors: (item.directors ?? []).map((director) => director.peopleNm),
      }));
    }

    // KOBIS는 제목(movieNm)과 감독(directorNm)을 별도 필드로 검색해야 한다.
    // 둘 중 하나가 실패해도 나머지 검색 결과는 계속 보여준다.
    const [titleResult, directorResult] = await Promise.allSettled([
      searchBy("movieNm"),
      searchBy("directorNm"),
    ]);

    if (titleResult.status === "rejected" && directorResult.status === "rejected") {
      throw titleResult.reason;
    }

    const titleMovies = titleResult.status === "fulfilled" ? titleResult.value : [];
    const directorMovies = directorResult.status === "fulfilled" ? directorResult.value : [];
    const merged = new Map<string, KobisMovieSummary>();

    // 제목 결과를 먼저 넣어 동일 작품일 때 제목 검색 순위를 보존한다.
    for (const movie of [...titleMovies, ...directorMovies]) {
      if (!merged.has(movie.movieCd)) merged.set(movie.movieCd, movie);
    }

    return Array.from(merged.values()).slice(0, safeLimit);
  });
}

export type KobisMovieDetail = {
  movieCd: string;
  titleKo: string;
  titleEn: string;
  titleOriginal: string;
  prdtYear: string;
  openDt: string;
  runtimeMinutes: string;
  typeNm: string;
  nations: string[];
  genres: string[];
  directors: string[];
  actors: string[];
  watchGrade: string;
};

type SearchMovieInfoResponse = {
  movieInfoResult?: {
    movieInfo?: {
      movieCd: string;
      movieNm: string;
      movieNmEn?: string;
      movieNmOg?: string;
      prdtYear?: string;
      openDt?: string;
      showTm?: string;
      typeNm?: string;
      nations?: Array<{ nationNm: string }>;
      genres?: Array<{ genreNm: string }>;
      directors?: Array<{ peopleNm: string }>;
      actors?: Array<{ peopleNm: string }>;
      audits?: Array<{ watchGradeNm: string }>;
    };
  };
};

export async function getKobisMovieInfo(
  movieCd: string,
): Promise<KobisMovieDetail | null> {
  return withCache(`detail:${movieCd}`, DETAIL_CACHE_TTL_MS, async () => {
    const json = (await fetchKobisJson("movie/searchMovieInfo.json", {
      movieCd,
    })) as SearchMovieInfoResponse;

    const info = json.movieInfoResult?.movieInfo;
    if (!info) return null;

    return {
      movieCd: info.movieCd,
      titleKo: info.movieNm,
      titleEn: info.movieNmEn ?? "",
      titleOriginal: info.movieNmOg ?? "",
      prdtYear: info.prdtYear ?? "",
      openDt: info.openDt ?? "",
      runtimeMinutes: info.showTm ?? "",
      typeNm: info.typeNm ?? "",
      nations: (info.nations ?? []).map((n) => n.nationNm),
      genres: (info.genres ?? []).map((g) => g.genreNm),
      directors: (info.directors ?? []).map((d) => d.peopleNm),
      actors: (info.actors ?? []).map((a) => a.peopleNm),
      watchGrade: info.audits?.[0]?.watchGradeNm ?? "",
    };
  });
}

export function formatKobisOpenDate(openDt: string) {
  if (!/^\d{8}$/.test(openDt)) return "";
  return `${openDt.slice(0, 4)}.${openDt.slice(4, 6)}.${openDt.slice(6, 8)}`;
}

export function formatKobisRuntime(minutes: string) {
  const value = Number(minutes);
  if (!value || Number.isNaN(value)) return "";
  const hours = Math.floor(value / 60);
  const remaining = value % 60;
  if (hours <= 0) return `${remaining}분`;
  if (remaining === 0) return `${hours}시간`;
  return `${hours}시간 ${remaining}분`;
}
