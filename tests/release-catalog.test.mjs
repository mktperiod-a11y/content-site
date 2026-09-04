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

test("stores movie, provider, and sync state records in D1", () => {
  assert.match(schemaSource, /sqliteTable\(\s*"movies"/);
  assert.match(schemaSource, /sqliteTable\(\s*"movie_providers"/);
  assert.match(schemaSource, /sqliteTable\("sync_state"/);
  assert.match(schemaSource, /idx_movies_open_date/);
  assert.match(schemaSource, /idx_movie_providers_movie_type/);
});

test("refreshes at most once per 24 hours and keeps prior rows on failure", () => {
  assert.match(catalogSource, /RELEASE_SYNC_INTERVAL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(catalogSource, /acquireSyncLock/);
  assert.match(catalogSource, /last_success_at <= \?/);
  assert.doesNotMatch(catalogSource, /DELETE FROM movies/);
  assert.match(catalogSource, /status = 'error'/);
});

test("renders crawlable release routes as an in-page chip switch", () => {
  assert.match(pageSource, /href="\/movies\/now"/);
  assert.match(pageSource, /href="\/movies\/upcoming"/);
  assert.match(pageSource, /aria-current=/);
  assert.match(pageSource, /href=\{`\/movie\/\$\{movie\.movieCd\}`\}/);
});

test("publishes stored movie pages through the XML sitemap", () => {
  assert.match(sitemapSource, /getSitemapMovieCodes/);
  assert.match(sitemapSource, /application\/xml/);
  assert.match(sitemapSource, /\/movies\/now/);
  assert.match(sitemapSource, /\/movies\/upcoming/);
  assert.match(sitemapSource, /\/movie\/\$\{encodeURIComponent/);
});
