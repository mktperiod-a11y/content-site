import { OnDiskBox } from "@/components/sponsored-ondisk";
import { SponsoredBox } from "@/components/sponsored-slot";

/** 온디스크 구좌가 나올 확률. 나머지는 KDisk 구좌다. */
export const ONDISK_SHARE = 0.5;

export type Sponsor = "kdisk" | "ondisk";

export function pickSponsor(): Sponsor {
  return Math.random() < ONDISK_SHARE ? "ondisk" : "kdisk";
}

/**
 * 작품 상세 사이드바의 제휴 구좌. 요청마다 서버에서 한 곳을 고른다.
 * 어느 쪽이든 작품 정보는 넘기지 않는다.
 */
export function RotatingSponsoredBox() {
  return pickSponsor() === "ondisk" ? <OnDiskBox /> : <SponsoredBox />;
}
