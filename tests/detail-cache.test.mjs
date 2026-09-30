import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const detailSource = await readFile(new URL("../app/movie/[movieCd]/page.tsx", import.meta.url), "utf8");
const cacheSource = await readFile(new URL("../lib/detail-cache.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../drizzle/0004_panoramic_sentinels.sql", import.meta.url), "utf8");

test("detail page reads the prefetched KOBIS and TMDB responses before calling out", () => {
  // 보관본을 먼저 보고, 없을 때만 외부를 부른 뒤 보관한다.
  assert.match(detailSource, /readFreshKobisDetail<KobisMovieDetail>\(movieCd\)/);
  assert.match(detailSource, /saveKobisDetail\(movieCd, data\)/);
  assert.match(detailSource, /readFreshTmdbDetail<TmdbBundle>\(movieCd, tmdbId\)/);
  assert.match(detailSource, /saveTmdbDetail\(movieCd, tmdbId, bundle\)/);
});

test("stored TMDB responses are only reused for the same match and while fresh", () => {
  assert.match(cacheSource, /row\.tmdb_id !== tmdbId/);
  assert.match(cacheSource, /TMDB_DETAIL_MAX_AGE_MS = 36 \* 60 \* 60 \* 1000/);
  // D1 문장 한도를 넘는 응답은 보관하지 않는다.
  assert.match(cacheSource, /MAX_JSON_LENGTH = 90_000/);
});

test("detail_cache table is created by a migration", () => {
  assert.match(migration, /CREATE TABLE `detail_cache`/);
  assert.match(migration, /`movie_cd` text PRIMARY KEY NOT NULL/);
});
