/**
 * 제휴 파트너 링크.
 *
 * 배너는 파트너 링크를 직접 걸지 않고 우리 주소(`/go/ondisk`, `/go/kdisk`)를 건다.
 * 그 주소가 아래 파트너 링크로 넘겨 주고, 최종 페이지는 파트너가 정한다.
 *
 *   배너 클릭 → /go/ondisk → 파트너 링크(inpid=mseesaw) → 파트너가 정한 최종 페이지
 *
 * 파트너 링크가 바뀌면 이 파일만 고치면 된다.
 */
export const PARTNER_LINKS = {
  ondisk: "https://ondisk.co.kr/mbridge.php?iw=md&inpid=mseesaw&j=2",
  kdisk: "https://kdisk.co.kr/mbridge.php?iw=md&inpid=mseesaw&j=2",
} as const;

export type Partner = keyof typeof PARTNER_LINKS;

/** 배너에 거는 우리 사이트 주소 */
export function partnerHref(partner: Partner) {
  return `/go/${partner}`;
}

/**
 * `/go/*` 응답. 클릭마다 파트너로 넘어가야 하므로 캐시하지 않고(no-store),
 * 검색엔진이 이 주소를 색인하거나 따라가지 않게 한다.
 */
export function redirectToPartner(partner: Partner) {
  return new Response(null, {
    status: 302,
    headers: {
      location: PARTNER_LINKS[partner],
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
