import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

// 소스 문자열 검사로는 SQL 오류를 잡지 못한다(2026-10-02, 포스터 수집 쿼리가 운영에서
// "SQL logic error"로 멈췄다). 마이그레이션으로 만든 실제 SQLite 위에서 쿼리를 돌린다.
const root = fileURLToPath(new URL("..", import.meta.url));
const sql = new DatabaseSync(":memory:");
for (const file of readdirSync(`${root}drizzle`).filter((name) => name.endsWith(".sql")).sort()) {
  for (const statement of readFileSync(`${root}drizzle/${file}`, "utf8").split("--> statement-breakpoint")) {
    if (statement.trim()) sql.exec(statement);
  }
}
const prepare = (query) => {
  let bound = [];
  const statement = {
    bind: (...args) => ((bound = args), statement),
    all: async () => ({ results: sql.prepare(query).all(...bound) }),
    first: async () => sql.prepare(query).get(...bound) ?? null,
    run: async () => (sql.prepare(query).run(...bound), {}),
  };
  return statement;
};
globalThis.__WHERE_TO_WATCH_DB__ = { prepare, batch: async (list) => Promise.all(list.map((s) => s.run())) };
// 외부 API 는 닫힌 주소로 보내 바로 실패하게 한다(쿼리만 확인한다).
process.env.KOBIS_API_BASE = "http://127.0.0.1:9";
process.env.TMDB_API_BASE = "http://127.0.0.1:9";

const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});
after(async () => {
  await vite.close();
});
const theater = await vite.ssrLoadModule("/lib/theater-catalog.ts");
const release = await vite.ssrLoadModule("/lib/release-catalog.ts");

const now = Date.now();
const insertTheater = sql.prepare(
  `INSERT INTO theater_movies (theater_code, theater_movie_id, title_ko, normalized_title, open_date,
     booking_available, checked_at, kobis_status, kobis_movie_cd)
   VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
);
insertTheater.run("cgv", "1", "시간을 달리는 소녀", "시간을달리는소녀", "20160114", now, "matched", "20070216");
insertTheater.run("cgv", "2", "파멸", "파멸", "20260916", now, "ambiguous", null);
insertTheater.run("lotte", "3", "새 영화", "새영화", "20260930", now, "pending", null);
const insertMovie = sql.prepare(
  `INSERT INTO movies (movie_cd, title_ko, normalized_title, production_year, open_date, updated_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
insertMovie.run("20070216", "시간을 달리는 소녀", "시간을달리는소녀", "2006", "20070713", now);
insertMovie.run("20119851", "시간을 달리는 소녀", "시간을달리는소녀", "2010", "20110324", now);
insertMovie.run("19880001", "파멸", "파멸", "1988", "", now);

test("collection queries run on a real SQLite schema", async () => {
  const posters = await theater.syncTheaterPosters();
  assert.equal(posters.refreshed, true);
  // 애매한 제목(파멸)은 포스터를 찾지 않는다.
  assert.equal(posters.checked, 2);

  const kobis = await theater.syncTheaterKobisMatches();
  assert.equal(kobis.refreshed, true);

  const ids = await theater.syncTheaterMovieTmdbIds();
  assert.equal(ids.refreshed, true);
});

test("the list follows the stored edition and leaves ambiguous titles unlinked", async () => {
  const { movies, unavailable } = await release.getReleaseCatalog("now");
  assert.equal(unavailable, false);
  const byTitle = Object.fromEntries(movies.map((movie) => [movie.titleKo, movie]));
  // 같은 제목 중 최근작(2010 실사)이 아니라 수집이 고른 2006 애니에 잇는다.
  assert.equal(byTitle["시간을 달리는 소녀"].movieCd, "20070216");
  assert.equal(byTitle["시간을 달리는 소녀"].productionYear, "2006");
  // 애매한 제목은 상세 없이 검색으로, 연도 미상.
  assert.equal(byTitle["파멸"].movieCd, null);
  assert.equal(byTitle["파멸"].productionYear, "");
  assert.equal(byTitle["파멸"].posterUrl, null);
});

test("detail pages do not claim another edition is in theaters", async () => {
  const live = await theater.getTheaterStatuses("시간을 달리는 소녀", "20119851");
  assert.notEqual(live.statuses.find((status) => status.code === "cgv").availability, "confirmed");
  const anime = await theater.getTheaterStatuses("시간을 달리는 소녀", "20070216");
  assert.equal(anime.statuses.find((status) => status.code === "cgv").bookingAvailable, true);
  await theater.getConfirmedTheatersByTitle(["파멸", "시간을 달리는 소녀"]);
});
