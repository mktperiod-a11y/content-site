// 국내 구독형 OTT 월 요금제.
//
// ⚠️ 확인 필요: TMDB는 어떤 서비스에서 볼 수 있는지는 알려주지만 "얼마인지"는
// 제공하지 않습니다. 아래 금액은 별도로 관리해야 하는 큐레이션 데이터이며,
// 요금제는 수시로 바뀌므로 공개 배포 전에 각 서비스 공식 요금 페이지에서
// 반드시 검증하고 PRICES_VERIFIED_ON을 갱신하세요.
//
// 비교 기준: 광고 없는 최저가 단일 요금제(대체로 '베이직'/'스탠다드').
// 서비스마다 화질·동시접속 조건이 달라 완전한 동일 조건 비교는 아닙니다.

/** 아래 금액을 마지막으로 확인한 날짜 (화면에 함께 노출됩니다) */
export const PRICES_VERIFIED_ON = "2026-09-03";

export type OttPlan = {
  id: string;
  /** 화면에 표시할 서비스명 */
  name: string;
  /** 월 요금 (원) */
  price: number;
  /** 어떤 요금제 기준인지 */
  planName: string;
  /**
   * TMDB watch/providers가 돌려주는 provider_name 후보들.
   * 정규화(소문자·공백제거) 후 비교합니다.
   */
  tmdbNames: string[];
};

export const OTT_PLANS: OttPlan[] = [
  {
    id: "netflix",
    name: "Netflix",
    price: 5500,
    planName: "광고형 스탠다드",
    tmdbNames: ["Netflix", "Netflix basic with Ads", "Netflix Standard with Ads"],
  },
  {
    id: "tving",
    name: "TVING",
    price: 5500,
    planName: "광고형 스탠다드",
    tmdbNames: ["TVING", "Tving"],
  },
  {
    id: "wavve",
    name: "Wavve",
    price: 7900,
    planName: "베이직",
    tmdbNames: ["wavve", "Wavve"],
  },
  {
    id: "watcha",
    name: "Watcha",
    price: 7900,
    planName: "베이직",
    tmdbNames: ["Watcha", "WATCHA"],
  },
  {
    id: "disney",
    name: "Disney+",
    price: 9900,
    planName: "스탠다드",
    tmdbNames: ["Disney Plus", "Disney+"],
  },
  {
    id: "coupang",
    name: "쿠팡플레이",
    price: 7890,
    planName: "와우 멤버십",
    tmdbNames: ["Coupang Play", "쿠팡플레이"],
  },
  {
    id: "appletv",
    name: "Apple TV+",
    price: 6500,
    planName: "월 구독",
    tmdbNames: ["Apple TV Plus", "Apple TV+", "AppleTV+"],
  },
  {
    id: "laftel",
    name: "라프텔",
    price: 9900,
    planName: "베이직",
    tmdbNames: ["laftel", "Laftel"],
  },
];

function normalizeProviderName(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

const PLAN_BY_TMDB_NAME = new Map<string, OttPlan>();
for (const plan of OTT_PLANS) {
  for (const name of plan.tmdbNames) {
    PLAN_BY_TMDB_NAME.set(normalizeProviderName(name), plan);
  }
}

/**
 * TMDB provider_name을 요금제가 등록된 OTT로 변환한다.
 * 요금을 모르는 서비스는 undefined를 반환하며, 비용 계산에서 제외하고
 * "요금 미등록"으로 따로 안내한다 (임의의 금액을 지어내지 않는다).
 */
export function findPlanByTmdbName(providerName: string): OttPlan | undefined {
  return PLAN_BY_TMDB_NAME.get(normalizeProviderName(providerName));
}

export const formatWon = new Intl.NumberFormat("ko-KR");
