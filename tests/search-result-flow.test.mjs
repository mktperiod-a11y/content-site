import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const detailSource = await readFile(
  new URL("../app/movie/[movieCd]/page.tsx", import.meta.url),
  "utf8",
);
const tmdbSource = await readFile(new URL("../lib/tmdb.ts", import.meta.url), "utf8");
const kdiskSource = await readFile(
  new URL("../components/kdisk-flow.tsx", import.meta.url),
  "utf8",
);

test("searches by partial title or director and enriches result cards", () => {
  assert.match(pageSource, /제목 일부, 영문·원제, 감독명/);
  assert.match(pageSource, /\/api\/movies\/search/);
  assert.match(pageSource, /\/api\/movies\/enrich/);
  assert.match(pageSource, /posterUrl/);
  assert.match(pageSource, /voteAverage/);
  assert.match(pageSource, /ProviderChips/);
  assert.match(pageSource, /md:grid-cols-2/);
  assert.doesNotMatch(pageSource, /data-ga-event="search_suggestion_select"\s+href=/);
});

test("shows TMDB images, ratings, reviews, and Korean watch providers", () => {
  assert.match(detailSource, /TMDB · 평가/);
  assert.match(detailSource, /TMDB 사용자 리뷰/);
  assert.match(detailSource, /국내 제공처/);
  assert.match(tmdbSource, /watch\/providers/);
  assert.match(tmdbSource, /results\?\.KR/);
});

test("defers KDisk catalog claims behind a user-controlled second step", () => {
  assert.match(kdiskSource, /다른 이용 방법 확인하기/);
  assert.match(kdiskSource, /실제 보유 여부는 KDisk 검색 결과에서 확인/);
  assert.doesNotMatch(kdiskSource, /KDisk 공식 제공 콘텐츠/);
  assert.doesNotMatch(kdiskSource, /이 작품은 KDisk에서도 이용할 수 있어요/);
});

test("keeps both main product tabs", () => {
  assert.match(pageSource, /영화 찾기/);
  assert.match(pageSource, /가격 비교하기/);
  assert.doesNotMatch(detailSource, /가격 비교에 담기/);
});
