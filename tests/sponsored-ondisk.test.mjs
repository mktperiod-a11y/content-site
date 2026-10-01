import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ondisk = await readFile(new URL("../components/sponsored-ondisk.tsx", import.meta.url), "utf8");
const rotation = await readFile(new URL("../components/sponsored-rotation.tsx", import.meta.url), "utf8");
const detail = await readFile(new URL("../app/movie/[movieCd]/page.tsx", import.meta.url), "utf8");
const compare = await readFile(new URL("../app/price-comparison.tsx", import.meta.url), "utf8");

test("keeps the OnDisk slot structurally unable to name a title", () => {
  // KDisk 구좌와 같은 원칙: 작품 정보를 받지도, 가리키지도 않는다.
  assert.doesNotMatch(ondisk, /titleKo|movieCd|movieTitle|searchTerm/);
  assert.match(ondisk, /제휴/);
  assert.match(ondisk, /export function OnDiskBox\(\{ className = "" \}: \{ className\?: string \}\)/);
  assert.match(ondisk, /export function OnDiskBanner\(\{ className = "" \}: \{ className\?: string \}\)/);
});

test("opens OnDisk through our /go/ondisk address in a new tab as a sponsored link", () => {
  // 파트너 링크는 lib/partner-links.ts 에만 두고, 배너는 우리 주소를 건다.
  assert.match(ondisk, /href: partnerHref\("ondisk"\)/);
  assert.doesNotMatch(ondisk, /https?:\/\//);
  assert.match(ondisk, /rel: "sponsored noopener noreferrer"/);
  assert.match(ondisk, /target: "_blank"/);
});

test("rotates KDisk and OnDisk in both sponsored slots", () => {
  assert.match(rotation, /ONDISK_SHARE = 0\.5/);
  assert.match(detail, /<RotatingSponsoredBox \/>/);
  // 가격 비교 구좌는 결과가 나온 뒤에만 그려지므로 한 번 고른 값을 유지한다.
  assert.match(compare, /useState\(pickSponsor\)/);
});
