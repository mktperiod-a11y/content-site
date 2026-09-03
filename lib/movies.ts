// 예시(프로토타입) 영화 데이터입니다. KOBIS·TMDB·KMDb 실연동 전까지 검색/가격비교
// 기능 검증을 위해 사용하는 하드코딩 데이터이며, 실제 OTT 제공 현황과 다를 수 있습니다.

export type OfferType = "구독" | "대여" | "구매";

export type MovieProvider = {
  /** PROVIDER_CATALOG의 키 */
  id: string;
  offers: OfferType[];
};

export type Movie = {
  id: string;
  titleKo: string;
  titleEn?: string;
  titleOriginal?: string;
  year: string;
  director: string;
  cast?: string[];
  genre?: string;
  runtime?: string;
  /** 관람등급 */
  rating?: string;
  synopsis?: string;
  /**
   * 구독형 OTT 제공처. 빈 배열이면 "현재 구독형 OTT에서는 확인되지 않는 작품"
   * 상태로 취급하고, 다른 이용 방법(2뎁스) 안내를 노출한다.
   */
  providers: MovieProvider[];
};

export const PROVIDER_CATALOG: Record<
  string,
  { name: string; price: number; plan: string }
> = {
  tving: { name: "TVING", price: 5500, plan: "예시 요금제" },
  netflix: { name: "Netflix", price: 7000, plan: "예시 요금제" },
  wavve: { name: "Wavve", price: 7900, plan: "예시 요금제" },
  watcha: { name: "Watcha", price: 7900, plan: "예시 요금제" },
  disney: { name: "Disney+", price: 9900, plan: "예시 요금제" },
};

export const MOVIES: Movie[] = [
  {
    id: "jose-2003",
    titleKo: "조제, 호랑이 그리고 물고기들",
    titleEn: "Josee, the Tiger and the Fish",
    titleOriginal: "ジョゼと虎と魚たち",
    year: "2003",
    director: "이누도 잇신",
    cast: ["이케와키 치즈루", "츠마부키 사토시"],
    genre: "드라마·로맨스",
    runtime: "1시간 56분",
    rating: "15세",
    synopsis: "다리가 불편한 조제와 대학생 츠네오가 만나 서로의 세계를 넓혀가는 이야기.",
    providers: [
      { id: "wavve", offers: ["구독", "대여", "구매"] },
      { id: "watcha", offers: ["구독"] },
      { id: "tving", offers: ["구독"] },
    ],
  },
  {
    id: "exhuma",
    titleKo: "파묘",
    titleEn: "Exhuma",
    year: "2024",
    director: "장재현",
    cast: ["최민식", "김고은", "유해진", "이도현"],
    genre: "미스터리·오컬트",
    runtime: "2시간 14분",
    rating: "15세",
    synopsis: "거액의 의뢰를 받은 무당과 풍수사, 장의사가 수상한 묘를 이장하며 벌어지는 이야기.",
    providers: [
      { id: "netflix", offers: ["구독"] },
      { id: "tving", offers: ["구독"] },
    ],
  },
  {
    id: "inside-out-2",
    titleKo: "인사이드 아웃 2",
    titleEn: "Inside Out 2",
    year: "2024",
    director: "켈시 만",
    genre: "애니메이션·가족",
    runtime: "1시간 36분",
    rating: "전체 관람가",
    synopsis: "사춘기를 맞은 라일리의 마음속에 새로운 감정들이 찾아오며 벌어지는 이야기.",
    providers: [{ id: "disney", offers: ["구독"] }],
  },
  {
    id: "dune-2",
    titleKo: "듄: 파트 2",
    titleEn: "Dune: Part Two",
    year: "2024",
    director: "드니 빌뇌브",
    cast: ["티모시 샬라메", "젠데이아"],
    genre: "SF·모험",
    runtime: "2시간 46분",
    rating: "12세",
    providers: [
      { id: "netflix", offers: ["구독"] },
      { id: "wavve", offers: ["구독"] },
    ],
  },
  {
    id: "roundup-4",
    titleKo: "범죄도시4",
    titleEn: "The Roundup: Punishment",
    year: "2024",
    director: "허명행",
    cast: ["마동석"],
    genre: "액션·범죄",
    rating: "15세",
    providers: [
      { id: "disney", offers: ["구독"] },
      { id: "tving", offers: ["구독"] },
    ],
  },
  {
    id: "12-12",
    titleKo: "서울의 봄",
    titleEn: "12.12: The Day",
    year: "2023",
    director: "김성수",
    cast: ["황정민", "정우성"],
    genre: "드라마",
    rating: "12세",
    providers: [
      { id: "netflix", offers: ["구독"] },
      { id: "wavve", offers: ["구독"] },
      { id: "watcha", offers: ["구독"] },
    ],
  },
  {
    id: "top-gun",
    titleKo: "탑건: 매버릭",
    titleEn: "Top Gun: Maverick",
    year: "2022",
    director: "조셉 코신스키",
    cast: ["톰 크루즈"],
    genre: "액션",
    rating: "12세",
    providers: [
      { id: "netflix", offers: ["구독"] },
      { id: "tving", offers: ["구독"] },
    ],
  },
  {
    id: "decision-to-leave",
    titleKo: "헤어질 결심",
    titleEn: "Decision to Leave",
    year: "2022",
    director: "박찬욱",
    cast: ["박해일", "탕웨이"],
    genre: "드라마·미스터리",
    rating: "15세",
    synopsis: "산에서 발생한 변사 사건을 수사하던 형사가 죽은 자의 아내를 만나며 벌어지는 이야기.",
    providers: [
      { id: "netflix", offers: ["구독"] },
      { id: "watcha", offers: ["구독"] },
    ],
  },
  {
    id: "oldboy",
    titleKo: "올드보이",
    titleEn: "Oldboy",
    year: "2003",
    director: "박찬욱",
    cast: ["최민식", "유지태"],
    genre: "스릴러·미스터리",
    rating: "청소년 관람불가",
    providers: [{ id: "watcha", offers: ["구독"] }],
  },
  // 아래 두 편은 "동명 작품을 연도·감독으로 구분" 기능을 검증하기 위한 예시 데이터입니다.
  {
    id: "summer-goodbye-a",
    titleKo: "여름, 안녕",
    year: "2012",
    director: "예시감독 A",
    genre: "드라마",
    synopsis: "검색 기능 검증용 예시 데이터입니다.",
    providers: [{ id: "tving", offers: ["구독"] }],
  },
  {
    id: "summer-goodbye-b",
    titleKo: "여름, 안녕",
    year: "2020",
    director: "예시감독 B",
    genre: "다큐멘터리",
    synopsis: "검색 기능 검증용 예시 데이터입니다.",
    providers: [],
  },
  // 구독형 OTT 미확인(다른 이용 방법 안내) 흐름을 검증하기 위한 예시 데이터입니다.
  {
    id: "faraway-sea-song",
    titleKo: "먼 바다의 노래",
    year: "2021",
    director: "예시감독",
    genre: "드라마",
    synopsis: "검색 기능 검증용 예시 데이터입니다. 구독형 OTT 미확인 상태를 보여줍니다.",
    providers: [],
  },
];

export function normalizeSearchValue(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s,.:;!?'"“”·\-_/()[\]]/g, "")
    .toLowerCase();
}

function movieMatchesQuery(movie: Movie, normalizedQuery: string) {
  const fields = [movie.titleKo, movie.titleEn, movie.titleOriginal, movie.director];
  return fields.some(
    (field) => field && normalizeSearchValue(field).includes(normalizedQuery),
  );
}

export function searchMovies(query: string, limit?: number): Movie[] {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return [];

  const results = MOVIES.filter((movie) => movieMatchesQuery(movie, normalizedQuery));
  return typeof limit === "number" ? results.slice(0, limit) : results;
}

export function getMovieById(id: string): Movie | undefined {
  return MOVIES.find((movie) => movie.id === id);
}

/**
 * KOBIS 등 외부 출처의 작품명·제작연도와 내부 예시 제공처 데이터를 정확히
 * 일치하는 경우에만 연결한다. 불확실한 매칭에는 OTT 정보를 임의로 연결하지
 * 않는다는 원칙에 따라 제목·연도가 모두 일치할 때만 반환한다.
 */
export function findLocalProviderMatch(titleKo: string, year?: string): Movie | undefined {
  const normalizedTitle = normalizeSearchValue(titleKo);
  return MOVIES.find((movie) => {
    if (normalizeSearchValue(movie.titleKo) !== normalizedTitle) return false;
    if (year && movie.year && movie.year !== year) return false;
    return true;
  });
}
