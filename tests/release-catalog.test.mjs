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
const searchPageSource = await readFile(
  new URL("../app/search/page.tsx", import.meta.url),
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
  assert.match(catalogSource, /CURRENT_PAGE_LIMIT = 200/);
  assert.match(catalogSource, /WITH theater_titles AS/);
  assert.match(catalogSource, /FROM theater_movies/);
  assert.match(catalogSource, /LEFT JOIN movies AS m/);
  assert.doesNotMatch(catalogSource, /WHERE booking_available = 1/);
  assert.match(pageSource, /지금 극장에서 만날 영화/);
  // 3사 모두에 걸린 와이드 릴리즈를 단관 상영작보다 먼저 보여준다.
  assert.match(catalogSource, /COUNT\(DISTINCT theater_code\) AS theater_count/);
  assert.match(
    catalogSource,
    /ORDER BY theater_titles\.theater_count DESC, open_date DESC/,
  );
  assert.doesNotMatch(pageSource, /TheaterStatusBadge/);
  assert.match(searchPageSource, /TheaterStatusBadge/);
  assert.match(theaterSource, /ss\.last_success_at >= \?/);
  assert.match(theaterSource, /ss\.status != 'error'/);
});

test("renders crawlable release routes as an in-page chip switch", () => {
  assert.match(pageSource, /href="\/movies\/now"/);
  assert.match(pageSource, /href="\/movies\/upcoming"/);
  assert.match(pageSource, /aria-current=/);
  assert.match(pageSource, /movie\.movieCd \?/);
  assert.match(pageSource, /movie\.movieCd \?\? movie\.titleKo/);
  assert.match(pageSource, /href=\{`\/movie\/\$\{movie\.movieCd\}`\}/);
});

test("backs off instead of retrying a failed sync on every visit", () => {
  // 실패 직후 잠금을 풀어버리면 stale이 계속 true라, 방문자가 페이지를 열 때마다
  // /api/releases/refresh가 자동으로 돌며 외부 API를 다시 때린다.
  assert.match(theaterSource, /export const SYNC_RETRY_COOLDOWN_MS/);
  for (const source of [theaterSource, catalogSource]) {
    // 실패 경로가 lock_until을 0으로 되돌리지 않는다.
    assert.match(source, /SET lock_until = \?, lock_token = NULL, status = 'error'/);
    assert.match(source, /failedAt \+ SYNC_RETRY_COOLDOWN_MS/);
  }
  assert.doesNotMatch(
    theaterSource,
    /SET lock_until = 0, lock_token = NULL, status = 'error'/,
  );
  assert.doesNotMatch(
    catalogSource,
    /SET lock_until = 0, lock_token = NULL, status = 'error'/,
  );
});

test("does not skip a daily sync because the previous run finished late", () => {
  // last_success_at 은 수집이 끝난 시각이라 크론이 뜬 시각보다 늘 조금 뒤다.
  // TTL 을 정확히 24시간으로 재면 다음 날 크론이 몇 초 차이로 튕겨
  // 실제 수집이 이틀에 한 번만 돈다. 잠금 조건의 여유를 확인한다.
  assert.match(theaterSource, /SYNC_SLACK_MS/);
  assert.match(
    theaterSource,
    /now - \(THEATER_SYNC_INTERVAL_MS - SYNC_SLACK_MS\)/,
  );
  assert.match(
    catalogSource,
    /now - \(RELEASE_SYNC_INTERVAL_MS - SYNC_SLACK_MS\)/,
  );

  const DAY = 24 * 60 * 60 * 1000;
  const SLACK = 60 * 60 * 1000;
  const RUN_DURATION = 45 * 1000;
  // 크론이 매일 같은 시각에 뜨고, 수집은 45초 걸린다고 본다.
  const canAcquire = (lastSuccessAt, now, slack) =>
    lastSuccessAt === null || lastSuccessAt <= now - (DAY - slack);

  let lastSuccessAt = null;
  const acquiredWithoutSlack = [];
  for (let day = 0; day < 4; day += 1) {
    const cronAt = day * DAY;
    if (canAcquire(lastSuccessAt, cronAt, 0)) {
      acquiredWithoutSlack.push(day);
      lastSuccessAt = cronAt + RUN_DURATION;
    }
  }
  // 여유가 없으면 격일로만 수집된다 (이게 버그였다).
  assert.deepEqual(acquiredWithoutSlack, [0, 2]);

  lastSuccessAt = null;
  const acquiredWithSlack = [];
  for (let day = 0; day < 4; day += 1) {
    const cronAt = day * DAY;
    if (canAcquire(lastSuccessAt, cronAt, SLACK)) {
      acquiredWithSlack.push(day);
      lastSuccessAt = cronAt + RUN_DURATION;
    }
  }
  assert.deepEqual(acquiredWithSlack, [0, 1, 2, 3]);
});

test("keeps posterless upcoming cards from breaking apart", () => {
  // grid + place-items-center 는 자식 둘을 각각 다른 행에 중앙 정렬해
  // 포스터가 없는 카드에서 아이콘과 문구가 카드 높이만큼 벌어졌다.
  assert.doesNotMatch(pageSource, /grid size-full place-items-center/);
  assert.match(pageSource, /flex size-full flex-col items-center justify-center/);
  // 아직 개봉하지 않은 작품에 구독형 제공처 안내를 붙이지 않는다.
  assert.match(pageSource, /view === "upcoming"/);
  assert.match(pageSource, /개봉 후 제공처가 확인돼요/);
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
  // 반대쪽 목록은 편수만 필요해 집계 한 번으로 대체했다(getReleaseCount).
  assert.match(pageSource, /\{nowCount\}편/);
  assert.match(pageSource, /\{upcomingCount\}편/);
  assert.match(pageSource, /getReleaseCount\(isUpcoming \? "now" : "upcoming"\)/);
  assert.match(catalogSource, /export async function getReleaseCount/);
  assert.match(pageSource, /tracking-\[1px\]/);
});
