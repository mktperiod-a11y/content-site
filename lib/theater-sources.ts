export const THEATER_CODES = ["cgv", "megabox", "lotte"] as const;

export type TheaterCode = (typeof THEATER_CODES)[number];

export type TheaterSourceMovie = {
  theaterCode: TheaterCode;
  theaterMovieId: string;
  titleKo: string;
  normalizedTitle: string;
  openDate: string;
  bookingAvailable: boolean;
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

function isYes(value: unknown) {
  return ["Y", "YES", "TRUE", "1"].includes(asString(value).toUpperCase());
}

export function normalizeTheaterTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
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
    const titleKo = asString(value.movNm);
    const normalizedTitle = normalizeTheaterTitle(titleKo);
    if (!theaterMovieId || !normalizedTitle) return [];
    return [{
      theaterCode: "cgv" as const,
      theaterMovieId,
      titleKo,
      normalizedTitle,
      openDate: normalizeTheaterDate(value.realOpenYmd || value.rlsYmd),
      bookingAvailable: isYes(value.atktPsblYn),
    }];
  });
}

export async function listCgvCurrentMovies() {
  const payload = await fetchJson(
    "https://api.cgv.co.kr/met/dsp/scrDsp/searchScrDspCpotDtl?coCd=A420&unitCpotRelNo=1",
    { headers: { Accept: "application/json", "User-Agent": USER_AGENT } },
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
    const titleKo = asString(value.movieNm);
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
      bookingAvailable: isYes(value.bokdAbleYn || value.bokdAbleAt),
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
    const titleKo = asString(value.MovieNameKR);
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
