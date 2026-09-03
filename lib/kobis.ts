// KOBIS(영화진흥위원회 영화관입장권통합전산망) Open API 클라이언트.
// 서버 전용 모듈입니다 — KOBIS_API_KEY는 절대 클라이언트 번들에 포함되지 않도록
// 이 파일을 Route Handler / Server Component에서만 import 하세요 (client component에서 import 금지).

const KOBIS_BASE = "https://www.kobis.or.kr/kobisopenapi/webservice/rest";
const REQUEST_TIMEOUT_MS = 8000;

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
  const json = (await fetchKobisJson("movie/searchMovieList.json", {
    movieNm: query,
    itemPerPage: String(Math.min(Math.max(limit, 1), 30)),
  })) as SearchMovieListResponse;

  const list = json.movieListResult?.movieList ?? [];
  return list.map((item) => ({
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
