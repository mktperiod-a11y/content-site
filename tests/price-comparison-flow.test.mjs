import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const comparisonSource = await readFile(
  new URL("../app/price-comparison.tsx", import.meta.url),
  "utf8",
);

const pageSource = await readFile(
  new URL("../app/search/page.tsx", import.meta.url),
  "utf8",
);

const watchOptionsSource = await readFile(
  new URL("../app/watch-options/page.tsx", import.meta.url),
  "utf8",
);

const sponsoredSource = await readFile(
  new URL("../components/sponsored-slot.tsx", import.meta.url),
  "utf8",
);

test("starts the calculator with an empty selection", () => {
  assert.match(comparisonSource, /useState<KobisMovieSummary\[\]>\(\[\]\)/);
  assert.match(comparisonSource, /MAX_SELECTED = 5/);
});

test("separates search, selected, recommendation, and no-result states", () => {
  assert.match(comparisonSource, /보고 싶은 작품/);
  assert.match(comparisonSource, /검색 결과/);
  assert.match(comparisonSource, /availableSearchResults\.length/);
  assert.match(comparisonSource, /searchResults\.length === 8/);
  assert.match(comparisonSource, /검색 결과가 없어요/);
  assert.match(comparisonSource, /가장 효율적이에요/);
  assert.match(comparisonSource, /한 곳만 구독한다면/);
  assert.match(comparisonSource, /가능한 작품을 전부 보려면/);
  assert.match(comparisonSource, /PRICES_VERIFIED_ON/);
});

test("distinguishes lookup failures and providers without curated prices", () => {
  assert.match(comparisonSource, /제공처 확인 필요/);
  assert.match(comparisonSource, /요금 확인 필요/);
  assert.match(comparisonSource, /coverage\.unpricedProviders\.length > 0/);
  assert.match(comparisonSource, /subscription: null/);
});

test("does not recommend a plan when any selected title remains unverified", () => {
  assert.match(comparisonSource, /recommendationBlocked =/);
  assert.match(comparisonSource, /unknownMovies\.length > 0 \|\| unpricedMovies\.length > 0/);
  assert.match(comparisonSource, /확인되지 않은 항목이 있어 추천하지 않아요/);
  assert.match(comparisonSource, /!recommendationBlocked/);
});

test("defers alternative services to a generic, copyright-safe comparison page", () => {
  // 진입점이 제휴 구좌로 바뀌었고, 링크는 그 컴포넌트가 들고 있다.
  assert.match(comparisonSource, /SponsoredBanner/);
  assert.match(sponsoredSource, /WATCH_OPTIONS_HREF = "\/watch-options"/);
  assert.doesNotMatch(comparisonSource, /KDisk에서 확인하기/);
  assert.doesNotMatch(comparisonSource, /OnDisk에서도 확인/);
  assert.match(watchOptionsSource, /구독형 OTT/);
  assert.match(watchOptionsSource, /작품 대여·구매/);
  assert.match(watchOptionsSource, /극장·VOD/);
  assert.match(watchOptionsSource, /작품별 콘텐츠 이용 서비스/);
  assert.match(watchOptionsSource, /실제 제공 여부와 이용 조건은 KDisk 검색 결과/);
  assert.doesNotMatch(watchOptionsSource, /titleKo|movieTitle|searchTerm/);
});

test("keeps the sponsored slot structurally unable to name a title", () => {
  // 광고가 특정 작품과 이어져 보이면 "이 작품을 저기서 볼 수 있다"는 오해를 만든다.
  // 문구로 조심하는 대신, 작품 정보를 받을 수 없는 구조로 둔다.
  assert.doesNotMatch(sponsoredSource, /titleKo|movieCd|movieTitle|searchTerm/);
  assert.match(sponsoredSource, /제휴/);
  // 작품명과 광고를 잇던 문장을 걷어냈는지 확인한다.
  assert.doesNotMatch(comparisonSource, /다른 이용 방법에서 작품명으로/);
});

test("renders the main navigation as prominent primary tabs", () => {
  assert.match(pageSource, /rounded-none bg-transparent/);
  assert.match(pageSource, /after:bg-brand/);
  assert.match(pageSource, /data-\[state=active\]:text-brand/);
  assert.match(pageSource, /href="\/movies\/now"/);
});

test("keeps the two hero layouts aligned and responsive", () => {
  const sharedHeroPadding = /px-5 py-14 sm:px-8 sm:py-16/;
  assert.match(pageSource, sharedHeroPadding);
  assert.match(comparisonSource, sharedHeroPadding);
  assert.match(pageSource, /text-on-dark-primary/);
  assert.match(comparisonSource, /text-on-dark-primary/);
  assert.match(pageSource, /lg:grid-cols-/);
  assert.match(comparisonSource, /lg:grid-cols-/);
});

test("keeps discovery and comparison independent", () => {
  assert.doesNotMatch(pageSource, /useSearchParams/);
  assert.doesNotMatch(pageSource, /initialAddId/);
  assert.doesNotMatch(pageSource, /tab=compare&add/);
  assert.doesNotMatch(comparisonSource, /api\/movies\/lookup/);
});
