import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(
  new URL("../app/search/page.tsx", import.meta.url),
  "utf8",
);
const rootSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const detailSource = await readFile(
  new URL("../app/movie/[movieCd]/page.tsx", import.meta.url),
  "utf8",
);
const tmdbSource = await readFile(new URL("../lib/tmdb.ts", import.meta.url), "utf8");
const kdiskSource = await readFile(
  new URL("../components/kdisk-flow.tsx", import.meta.url),
  "utf8",
);
const movieSearchSource = await readFile(
  new URL("../lib/movie-search.ts", import.meta.url),
  "utf8",
);
const headerSearchSource = await readFile(
  new URL("../components/header-search.tsx", import.meta.url),
  "utf8",
);
const siteHeaderSource = await readFile(
  new URL("../components/site-header.tsx", import.meta.url),
  "utf8",
);
const catalogSource = await readFile(
  new URL("../components/release-catalog-page.tsx", import.meta.url),
  "utf8",
);
const sitemapSource = await readFile(
  new URL("../app/sitemap.xml/route.ts", import.meta.url),
  "utf8",
);
const searchLayoutSource = await readFile(
  new URL("../app/search/layout.tsx", import.meta.url),
  "utf8",
);

test("searches by partial title or director and enriches result cards", () => {
  assert.match(pageSource, /제목 일부, 영문·원제, 감독명/);
  assert.match(movieSearchSource, /\/api\/movies\/search/);
  assert.match(pageSource, /fetchMovieSearch/);
  assert.match(pageSource, /\/api\/movies\/enrich/);
  assert.match(pageSource, /posterUrl/);
  assert.match(pageSource, /voteAverage/);
  assert.match(pageSource, /ProviderChips/);
  assert.match(pageSource, /md:grid-cols-2/);
  assert.doesNotMatch(pageSource, /data-ga-event="search_suggestion_select"\s+href=/);
});

test("makes the example search actionable and explains the two-character minimum", () => {
  assert.match(pageSource, /placeholder="영화 제목 또는 감독명 검색"/);
  assert.match(pageSource, /minLength=\{2\}/);
  assert.match(pageSource, /2글자 이상 입력하면 검색 결과가 보여요/);
  assert.match(pageSource, /예시 검색/);
  assert.match(pageSource, /onClick=\{showExample\}/);
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

test("orders the navigation with releases first and discovery last", () => {
  for (const source of [pageSource, catalogSource]) {
    assert.ok(source.indexOf("개봉작") < source.indexOf("영화 찾기"));
    assert.ok(source.indexOf("가격 비교하기") < source.indexOf("영화 찾기"));
  }
});

test("lands on the release list and keeps discovery at /search", () => {
  assert.match(rootSource, /redirect\("\/movies\/now"\)/);
  assert.match(catalogSource, /href="\/search"/);
  assert.match(catalogSource, /href="\/search\?tab=compare"/);
  assert.match(headerSearchSource, /\/search\?q=/);
  assert.doesNotMatch(sitemapSource, /urlEntry\(siteUrl, ""/);
});

test("keeps the client-rendered search page out of the index", () => {
  assert.match(searchLayoutSource, /robots: \{ index: false, follow: true \}/);
  assert.doesNotMatch(sitemapSource, /"\/search"/);
});

test("offers the same search from the header on every page", () => {
  // 헤더 검색도 본문 검색과 같은 계약(2글자·자동완성 6건·키보드 이동)을 쓴다.
  assert.match(headerSearchSource, /fetchMovieSearch\(trimmed, 6, controller\.signal\)/);
  assert.match(headerSearchSource, /isSearchable/);
  assert.match(headerSearchSource, /placeholder="영화 제목 또는 감독명 검색"/);
  assert.match(headerSearchSource, /ArrowDown/);
  assert.match(movieSearchSource, /MIN_SEARCH_LENGTH = 2/);

  // 홈 밖에서는 검색 탭으로 넘겨주고, 홈은 자기 결과 영역을 직접 갱신한다.
  assert.match(headerSearchSource, /router\.push\(`\/search\?q=\$\{encodeURIComponent\(trimmed\)\}`\)/);
  assert.match(pageSource, /onSearch=\{handleHeaderSearch\}/);
  assert.match(pageSource, /params\.get\("q"\)/);
  assert.match(siteHeaderSource, /search \?\? <HeaderSearch \/>/);
});
