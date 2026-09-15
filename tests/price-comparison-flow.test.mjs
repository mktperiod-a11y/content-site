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
  assert.match(comparisonSource, /href="\/watch-options"/);
  assert.doesNotMatch(comparisonSource, /KDisk에서 확인하기/);
  assert.doesNotMatch(comparisonSource, /OnDisk에서도 확인/);
  assert.match(watchOptionsSource, /구독형 OTT/);
  assert.match(watchOptionsSource, /작품 대여·구매/);
  assert.match(watchOptionsSource, /극장·VOD/);
  assert.match(watchOptionsSource, /작품별 콘텐츠 이용 서비스/);
  assert.match(watchOptionsSource, /실제 제공 여부와 이용 조건은 KDisk 검색 결과/);
  assert.doesNotMatch(watchOptionsSource, /titleKo|movieTitle|searchTerm/);
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
