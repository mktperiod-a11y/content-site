import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const backLinkSource = await readFile(
  new URL("../components/back-link.tsx", import.meta.url),
  "utf8",
);
const watchOptionsSource = await readFile(
  new URL("../app/watch-options/page.tsx", import.meta.url),
  "utf8",
);

test("returns to wherever the visitor came from, not a fixed tab", () => {
  // /watch-options는 가격 비교 결과와 작품 상세의 제휴 배너 양쪽에서 들어온다.
  // 예전에는 두 버튼 모두 /search?tab=compare로 하드코딩돼, 1탭 > 작품 상세에서
  // 들어온 사람을 가본 적 없는 화면으로 튕겼다.
  assert.doesNotMatch(watchOptionsSource, /href="\/search\?tab=compare"/);
  assert.equal(watchOptionsSource.match(/<BackLink/g)?.length, 2);
  assert.equal(
    watchOptionsSource.match(/fallbackHref="\/search\?tab=compare"/g)?.length,
    2,
  );
  assert.match(backLinkSource, /router\.back\(\)/);
});

test("falls back to a real link when there is nowhere to go back to", () => {
  // 서버에서는 평범한 링크로 그려져야 자바스크립트가 없어도 동작하고
  // 크롤러도 따라갈 수 있다.
  assert.match(backLinkSource, /href=\{fallbackHref\}/);
  assert.match(backLinkSource, /if \(!cameFromInsideApp\) return;/);
  // 새 탭·수식키 클릭은 브라우저에 맡긴다.
  assert.match(backLinkSource, /event\.metaKey/);
  assert.match(backLinkSource, /event\.button !== 0/);
});

test("keeps the sponsored slot free of movie details", () => {
  // 돌아갈 곳을 배너에 실어 보내면 광고 링크가 작품과 엮인다.
  // 히스토리로 푸는 이유이기도 하다.
  assert.doesNotMatch(backLinkSource, /movieCd|titleKo|movieTitle/);
});
