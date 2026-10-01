import { redirectToPartner } from "@/lib/partner-links";

/** 제휴 배너가 거는 주소. 파트너 링크로 넘겨 준다 (lib/partner-links.ts). */
export function GET() {
  return redirectToPartner("kdisk");
}
