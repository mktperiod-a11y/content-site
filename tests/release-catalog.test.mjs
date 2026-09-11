import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogSource = await readFile(
  new URL("../lib/release-catalog.ts", import.meta.url),
  "utf8",
);
const schemaSource = await readFile(
  new URL("../db/schema.ts", import.meta.url),
  "utf8",
);
const pageSource = await readFile(
  new URL("../components/release-catalog-page.tsx", import.meta.url),
  "utf8",
);
const sitemapSource = await readFile(
  new URL("../app/sitemap.xml/route.ts", import.meta.url),
  "utf8",
);
const kobisSource = await readFile(
  new URL("../lib/kobis.ts", import.meta.url),
  "utf8",
);
const headerSource = await readFile(
  new URL("../components/site-header.tsx", import.meta.url),
  "utf8",
);
const theaterSource = await readFile(
  new URL("../lib/theater-catalog.ts", import.meta.url),
  "utf8",
);
const workerSource = await readFile(
  new URL("../worker/index.ts", import.meta.url),
  "utf8",
);
const viteSource = await readFile(
  new URL("../vite.config.ts", import.meta.url),
  "utf8",
);

test("stores movie, provider, and sync state records in D1", () => {
  assert.match(schemaSource, /sqliteTable\(\s*"movies"/);
  assert.match(schemaSource, /sqliteTable\(\s*"movie_providers"/);
  assert.match(schemaSource, /sqliteTable\("sync_state"/);
  assert.match(schemaSource, /sqliteTable\(\s*"theater_movies"/);
  assert.match(schemaSource, /idx_movies_open_date/);
  assert.match(schemaSource, /idx_movie_providers_movie_type/);
});

test("refreshes releases weekly and theater snapshots daily without deleting on source failure", () => {
  assert.match(catalogSource, /RELEASE_SYNC_INTERVAL_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(theaterSource, /THEATER_SYNC_INTERVAL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(catalogSource, /acquireSyncLock/);
  assert.match(catalogSource, /last_success_at <= \?/);
  assert.doesNotMatch(catalogSource, /DELETE FROM movies/);
  assert.match(catalogSource, /status = 'error'/);
  assert.match(theaterSource, /DELETE FROM theater_movies WHERE theater_code = \? AND checked_at < \?/);
  assert.match(workerSource, /syncTheaterCatalog/);
  assert.match(viteSource, /0 18 \* \* \*/);
});

test("uses theater-company snapshots rather than a 60-day window for current screenings", () => {
  assert.match(catalogSource, /WITH theater_titles AS/);
  assert.match(catalogSource, /FROM theater_movies/);
  assert.match(catalogSource, /LEFT JOIN movies AS m/);
  assert.match(pageSource, /국내 극장 3사 현재상영작 기준/);
  assert.match(pageSource, /TheaterStatusBadge/);
});

test("renders crawlable release routes as an in-page chip switch", () => {
  assert.match(pageSource, /href="\/movies\/now"/);
  assert.match(pageSource, /href="\/movies\/upcoming"/);
  assert.match(pageSource, /aria-current=/);
  assert.match(pageSource, /movie\.movieCd \?/);
  assert.match(pageSource, /href=\{`\/movie\/\$\{movie\.movieCd\}`\}/);
});

test("publishes stored movie pages through the XML sitemap", () => {
  assert.match(sitemapSource, /getSitemapMovieCodes/);
  assert.match(sitemapSource, /application\/xml/);
  assert.match(sitemapSource, /\/movies\/now/);
  assert.match(sitemapSource, /\/movies\/upcoming/);
  assert.match(sitemapSource, /\/movie\/\$\{encodeURIComponent/);
});

test("uses KOBIS four-digit release years then filters exact dates", () => {
  assert.match(kobisSource, /openStartDt: openStartDt\.slice\(0, 4\)/);
  assert.match(kobisSource, /openEndDt: openEndDt\.slice\(0, 4\)/);
  assert.match(kobisSource, /movie\.openDt >= openStartDt/);
  assert.match(kobisSource, /movie\.openDt <= openEndDt/);
});

test("keeps release browsing in the primary navigation with clear return paths", () => {
  assert.doesNotMatch(headerSource, /최신·예정 개봉작/);
  assert.match(pageSource, /aria-label="주요 기능"/);
  assert.match(pageSource, /가격 비교하기/);
  assert.match(pageSource, /개봉작/);
  assert.match(pageSource, /href="\/search"/);
  assert.match(pageSource, /href="\/search\?tab=compare"/);
});

test("aligns the release hero with the core tabs and summarizes both lists", () => {
  assert.match(pageSource, /lg:grid-cols-\[minmax\(0,1fr\)_12rem\]/);
  assert.match(pageSource, /nowCatalog\.movies\.length/);
  assert.match(pageSource, /upcomingCatalog\.movies\.length/);
  assert.match(pageSource, /tracking-\[1px\]/);
});
