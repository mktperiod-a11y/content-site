import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const comparisonSource = await readFile(
  new URL("../app/price-comparison.tsx", import.meta.url),
  "utf8",
);

const pageSource = await readFile(
  new URL("../app/page.tsx", import.meta.url),
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
  assert.match(comparisonSource, /요금 비교 제외/);
  assert.match(comparisonSource, /subscription: null/);
});

test("does not describe KDisk or OnDisk catalog availability as official", () => {
  assert.doesNotMatch(comparisonSource, /KDisk·OnDisk의 공식 보유 여부/);
  assert.match(comparisonSource, /실제 보유 여부는 각 서비스 검색 결과/);
  assert.match(comparisonSource, /KDisk에서 확인하기/);
  assert.match(comparisonSource, /OnDisk에서도 확인/);
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
