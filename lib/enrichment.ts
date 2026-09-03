// 검색 결과 목록에 덧붙이는 포스터·제공처 정보의 공용 타입.
// 클라이언트 컴포넌트와 API 라우트가 함께 쓰므로, 서버 전용 모듈(lib/tmdb.ts)에
// 의존하지 않는 별도 파일로 분리한다.

export type EnrichedProvider = {
  name: string;
  logoUrl: string | null;
};

export type EnrichedMovie = {
  movieCd: string;
  posterUrl: string | null;
  /**
   * 구독형 제공처. 빈 배열이면 "확인했지만 구독형에는 없음",
   * null이면 "조회 자체를 하지 못함"이라 아무것도 단정하지 않는다.
   */
  subscription: EnrichedProvider[] | null;
  rentOrBuyCount: number;
};
