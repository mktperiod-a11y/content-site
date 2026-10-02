export const THEATER_CODES = ["cgv", "megabox", "lotte"] as const;

export type TheaterCode = (typeof THEATER_CODES)[number];

export type TheaterSourceMovie = {
  theaterCode: TheaterCode;
  theaterMovieId: string;
  titleKo: string;
  normalizedTitle: string;
  openDate: string;
  bookingAvailable: boolean;
  /** 극장사 포스터 주소. 어느 작품인지 애매하거나 TMDB 포스터가 없을 때만 카드에 쓴다. */
  posterUrl: string | null;
};

const REQUEST_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

/**
 * 극장사 응답의 영화 제목은 간혹 HTML 엔티티가 풀리지 않은 채 온다.
 * 그대로 저장하면 React가 다시 이스케이프해 화면에 `&amp;`가 문자로 보이고,
 * 정규화 제목에도 `amp`가 끼어 KOBIS 매칭까지 실패한다.
 */
export function decodeTheaterTitle(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, code: string) => {
      const normalized = code.toLowerCase();
      if (normalized in NAMED_HTML_ENTITIES) return NAMED_HTML_ENTITIES[normalized];

      const number = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      if (!Number.isInteger(number) || number < 0 || number > 0x10ffff) return entity;
      try {
        return String.fromCodePoint(number);
      } catch {
        return entity;
      }
    },
  );
}

function isYes(value: unknown) {
  return ["Y", "YES", "TRUE", "1"].includes(asString(value).toUpperCase());
}

export function normalizeTheaterTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * 극장사가 제목 앞뒤에 붙이는 상영 형태 표시. 작품 이름의 일부가 아니라
 * TMDB 에서 제목이 일치하지 않는 원인이 된다.
 */
const SCREENING_TAG_WORDS = [
  "앙코르", "재개봉", "리마스터링", "리마스터", "무삭제", "응원상영", "싱어롱",
  "더빙", "자막", "라이브뷰잉", "인피니티비전", "IMAX", "4DX", "ULTRA 4DX",
  "SCREENX", "스크린X", "MX4D", "돌비시네마", "돌비 애트모스", "돌비", "4K",
];
const TAG_PATTERN = SCREENING_TAG_WORDS
  .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .sort((a, b) => b.length - a.length)
  .join("|");
const LEADING_BRACKET = /^\s*[[(<【][^\])>】]{1,30}[\])>】]\s*/u;
const TRAILING_BRACKET = /\s*[[(<【][^\])>】]{1,30}[\])>】]\s*$/u;
const TRAILING_TAG = new RegExp(`[\\s\\-:·]*(?:${TAG_PATTERN})\\s*$`, "iu");

/**
 * TMDB 검색용으로 상영 형태 표시를 뗀 제목을 돌려준다. 떼어낼 것이 없으면
 * null 이다. 원래 제목으로 찾지 못했을 때의 두 번째 시도에만 쓰므로,
 * "(500)일의 썸머"처럼 괄호가 제목의 일부인 작품도 원래 제목에서 먼저 맞는다.
 */
export function stripScreeningTags(title: string) {
  let current = title.normalize("NFKC").trim();
  let previous;
  do {
    previous = current;
    current = current
      .replace(LEADING_BRACKET, "")
      .replace(TRAILING_BRACKET, "")
      .replace(TRAILING_TAG, "")
      .trim();
  } while (current !== previous);
  if (current.length < 2 || current === title.normalize("NFKC").trim()) return null;
  return current;
}

/**
 * CGV 포스터 주소. 목록 응답에 포스터 필드가 없어, 누리집이 쓰는 주소 규칙
 * (영화번호를 9자리로 채운 앞 6자리/영화번호/영화번호_320.jpg)으로 만든다.
 * 8자리 번호(30001476)는 누리집에서 실제로 뜨는 것을 확인했다. 5자리 옛 번호도
 * 예전 CGV 이미지 주소가 같은 규칙이라 쓰되, 못 불러오면 카드가 다음 포스터나
 * "포스터 준비 중"으로 넘어간다. 번호가 그 작품의 것이라 다른 작품 포스터가 뜨지는 않는다.
 */
export function cgvPosterUrl(movieNo: string) {
  if (!/^\d{5,9}$/.test(movieNo)) return null;
  const folder = movieNo.padStart(9, "0").slice(0, 6);
  return `https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/${folder}/${movieNo}/${movieNo}_320.jpg`;
}

/**
 * 극장 응답의 이미지 경로를 https 주소로 바꾼다. 상대 경로면 host 를 붙인다.
 * 우리 사이트가 https 라 http 이미지는 브라우저가 막거나 바꿔 부르므로 처음부터 https 로 둔다.
 */
export function toTheaterImageUrl(value: unknown, host: string) {
  const raw = asString(value);
  if (!raw || !/\.(?:jpe?g|png|webp|gif)(?:\?.*)?$/i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw.replace(/^\/\//, "https://"), host);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.protocol = "https:";
  // "cf.lottecinema.co.kr//Media/..." 처럼 겹친 빗금을 하나로 줄인다.
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  return url.toString();
}

export function normalizeTheaterDate(value: unknown) {
  const raw = asString(value);
  const match = raw.match(/(\d{4})\D?(\d{2})\D?(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : "";
}

function koreaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`극장사 응답 오류 (HTTP ${response.status})`);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error("극장사 응답을 해석할 수 없어요.");
  }
}

function findCgvCurrentMovies(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCgvCurrentMovies(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  const tabName = asString(value.tabExpoNm).replace(/\s/g, "");
  if (tabName === "현재상영작" && Array.isArray(value.movctSearchResDtoList)) {
    return value.movctSearchResDtoList;
  }
  for (const child of Object.values(value)) {
    const found = findCgvCurrentMovies(child);
    if (found) return found;
  }
  return null;
}

export function parseCgvCurrentMovies(payload: unknown): TheaterSourceMovie[] {
  const list = findCgvCurrentMovies(payload) ?? [];
  return list.flatMap((value) => {
    if (!isRecord(value)) return [];
    const theaterMovieId = asString(value.movNo);
    const titleKo = decodeTheaterTitle(asString(value.movNm));
    const normalizedTitle = normalizeTheaterTitle(titleKo);
    if (!theaterMovieId || !normalizedTitle) return [];
    return [{
      theaterCode: "cgv" as const,
      theaterMovieId,
      titleKo,
      normalizedTitle,
      openDate: normalizeTheaterDate(value.realOpenYmd || value.rlsYmd),
      bookingAvailable: isYes(value.atktPsblYn),
      posterUrl: cgvPosterUrl(theaterMovieId),
    }];
  });
}

export async function listCgvCurrentMovies() {
  const payload = await fetchJson(
    "https://api.cgv.co.kr/met/dsp/scrDsp/searchScrDspCpotDtl?coCd=A420&unitCpotRelNo=1",
    {
      // CGV 누리집이 이 목록을 부를 때 함께 보내는 출처 정보다. 없으면 403 으로 거절됐다.
      headers: {
        Accept: "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Origin: "https://cgv.co.kr",
        Referer: "https://cgv.co.kr/",
        "User-Agent": USER_AGENT,
      },
    },
  );
  const movies = parseCgvCurrentMovies(payload);
  if (!movies.length) throw new Error("CGV 현재상영작 목록이 비어 있어요.");
  return movies;
}

export function parseMegaboxMovies(payload: unknown, today = koreaToday()): TheaterSourceMovie[] {
  if (!isRecord(payload) || !Array.isArray(payload.movieList)) return [];
  return payload.movieList.flatMap((value) => {
    if (!isRecord(value)) return [];
    const theaterMovieId = asString(value.movieNo);
    const titleKo = decodeTheaterTitle(asString(value.movieNm));
    const normalizedTitle = normalizeTheaterTitle(titleKo);
    const openDate = normalizeTheaterDate(value.rfilmDe || value.rfilmDeReal);
    if (!theaterMovieId || !normalizedTitle || (openDate && openDate > today)) return [];
    if (asString(value.movieStatCd) && asString(value.movieStatCd) !== "MSC01") return [];
    return [{
      theaterCode: "megabox" as const,
      theaterMovieId,
      titleKo,
      normalizedTitle,
      openDate,
      bookingAvailable: isYes(value.bokdAbleYn) || isYes(value.bokdAbleAt),
      posterUrl: toTheaterImageUrl(value.imgPathNm, "https://img.megabox.co.kr"),
    }];
  });
}

export async function listMegaboxCurrentMovies() {
  const url = "https://www.megabox.co.kr/on/oh/oha/Movie/selectMovieList.do";
  const pageSize = 200;
  const merged = new Map<string, TheaterSourceMovie>();
  let total = pageSize;

  for (let page = 1; (page - 1) * pageSize < total && page <= 20; page += 1) {
    const payload = await fetchJson(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json;charset=UTF-8",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        currentPage: String(page),
        recordCountPerPage: String(pageSize),
        pageType: "ticketing",
        ibxMovieNo: "",
        onairYn: "Y",
        specialType: "",
        isAdult: "",
        masterType: "movie",
        sortType: "1",
      }),
    });
    if (!isRecord(payload)) throw new Error("메가박스 응답 형식이 바뀌었어요.");
    total = Number(payload.totCnt) || 0;
    const pageMovies = parseMegaboxMovies(payload);
    for (const movie of pageMovies) merged.set(movie.theaterMovieId, movie);
    const rawCount = Array.isArray(payload.movieList) ? payload.movieList.length : 0;
    if (!rawCount || rawCount < pageSize) break;
  }

  const movies = Array.from(merged.values());
  if (!movies.length) throw new Error("메가박스 현재상영작 목록이 비어 있어요.");
  return movies;
}

function getLotteItems(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.Movies) || !Array.isArray(payload.Movies.Items)) {
    return [] as unknown[];
  }
  return payload.Movies.Items;
}

export function parseLotteMovies(payload: unknown, today = koreaToday()): TheaterSourceMovie[] {
  return getLotteItems(payload).flatMap((value) => {
    if (!isRecord(value)) return [];
    const theaterMovieId = asString(value.RepresentationMovieCode);
    const titleKo = decodeTheaterTitle(asString(value.MovieNameKR));
    const normalizedTitle = normalizeTheaterTitle(titleKo);
    const openDate = normalizeTheaterDate(value.ReleaseDate);
    if (!theaterMovieId || !normalizedTitle || titleKo.toUpperCase() === "AD" || !openDate) return [];
    if (openDate > today || isYes(value.MoviePlayEndYN)) return [];
    if (asString(value.MoviePlayYN) && !isYes(value.MoviePlayYN)) return [];
    return [{
      theaterCode: "lotte" as const,
      theaterMovieId,
      titleKo,
      normalizedTitle,
      openDate,
      bookingAvailable: isYes(value.BookingYN),
      posterUrl: toTheaterImageUrl(value.PosterURL, "https://cf.lottecinema.co.kr"),
    }];
  });
}

export async function listLotteCurrentMovies() {
  const body = new FormData();
  body.set("paramList", JSON.stringify({
    MethodName: "GetMoviesToBe",
    channelType: "HO",
    osType: "Chrome",
    osVersion: USER_AGENT,
    multiLanguageID: "KR",
    division: 1,
    moviePlayYN: "Y",
    orderType: "1",
    blockSize: 1000,
    pageNo: 1,
    memberOnNo: "0",
    imgdivcd: 2,
  }));
  const payload = await fetchJson(
    "https://www.lottecinema.co.kr/LCWS/Movie/MovieData.aspx",
    { method: "POST", headers: { Accept: "application/json", "User-Agent": USER_AGENT }, body },
  );
  const movies = parseLotteMovies(payload);
  if (!movies.length) throw new Error("롯데시네마 현재상영작 목록이 비어 있어요.");
  return movies;
}

export const THEATER_SOURCE_LOADERS: Record<
  TheaterCode,
  () => Promise<TheaterSourceMovie[]>
> = {
  cgv: listCgvCurrentMovies,
  megabox: listMegaboxCurrentMovies,
  lotte: listLotteCurrentMovies,
};
