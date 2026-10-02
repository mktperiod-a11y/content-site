import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

// lib/theater-catalog.ts는 "@/db" 별칭을 쓰므로 vite를 거쳐 읽는다
// (tests/ui-components.test.mjs와 같은 방식).
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
after(async () => {
  await vite.close();
});

const { pickKobisMatch, pickByPopularity } = await vite.ssrLoadModule("/lib/theater-catalog.ts");
const catalogSource = await readFile(
  new URL("../lib/theater-catalog.ts", import.meta.url),
  "utf8",
);

function summary(movieCd, titleKo, openDt) {
  return {
    movieCd,
    titleKo,
    titleEn: "",
    prdtYear: openDt.slice(0, 4),
    openDt,
    genreAlt: "",
    nationAlt: "",
    directors: [],
  };
}

test("only accepts a KOBIS record whose normalized title matches exactly", () => {
  // 부분 일치를 허용하면 "괴물"이 "괴물들"을 물어온다. 잘못 붙은 상세 페이지는
  // 없는 것만 못하므로 정확히 같을 때만 채택한다.
  assert.equal(
    pickKobisMatch([summary("20259999", "괴물들", "20250101")], "괴물", "20240101"),
    null,
  );
  // 띄어쓰기·문장부호 차이는 정규화가 흡수한다.
  assert.equal(
    pickKobisMatch(
      [summary("20240001", "스파이더맨: 브랜드 뉴 데이", "20240101")],
      "스파이더맨브랜드뉴데이",
      "20240101",
    ).movieCd,
    "20240001",
  );
});

test("picks the edition closest to the date the theater reported", () => {
  const candidates = [
    summary("20000521", "화양연화", "20001102"),
    summary("20210999", "화양연화", "20210715"),
  ];
  // 재개봉 편성이라 극장이 알려준 날짜에 가까운 판본을 써야 한다.
  assert.equal(pickKobisMatch(candidates, "화양연화", "20210720").movieCd, "20210999");
  assert.equal(pickKobisMatch(candidates, "화양연화", "20001105").movieCd, "20000521");
  // 기준 날짜가 없으면 어느 편인지 가릴 근거가 없다.
  assert.equal(pickKobisMatch(candidates, "화양연화", ""), "ambiguous");
});

test("calls it ambiguous when no edition is within a year of the theater date", () => {
  // CGV 는 2006년 애니를 2016년 날짜로 걸었다. 가장 가까운 편(2010년 실사)을
  // 고르면 엉뚱한 작품의 상세·포스터가 붙는다.
  const candidates = [
    summary("20070070", "시간을 달리는 소녀", "20070705"),
    summary("20119851", "시간을 달리는 소녀", "20110324"),
  ];
  assert.equal(pickKobisMatch(candidates, "시간을달리는소녀", "20160114"), "ambiguous");
  // ±1년 안에 드는 편이 있으면 그 편이다.
  assert.equal(pickKobisMatch(candidates, "시간을달리는소녀", "20120301").movieCd, "20119851");
  assert.equal(pickKobisMatch(candidates, "시간을달리는소녀", "20060801").movieCd, "20070070");
});

test("keeps a lone exact match even when the years are far apart", () => {
  // 같은 제목이 한 편뿐이면 오래된 작품의 재개봉이다. 애매하지 않다.
  assert.equal(
    pickKobisMatch([summary("19980001", "8월의 크리스마스", "19980124")], "8월의크리스마스", "20260901").movieCd,
    "19980001",
  );
});

test("returns nothing when KOBIS has no candidate at all", () => {
  assert.equal(pickKobisMatch([], "정체불명의영화", "20250101"), null);
});

test("only asks KOBIS about titles that movies does not already cover", () => {
  // KOBIS 수집 창으로 이미 채운 제목까지 다시 물으면 수집할 때마다 쿼터를 그냥 태운다.
  assert.match(
    catalogSource,
    /NOT EXISTS \(\s*SELECT 1 FROM movies AS m\s*WHERE m\.normalized_title = tm\.normalized_title/,
  );
  // 이 수집이 이어 준 제목과 애매한 제목은 기한이 지나면 다시 확인한다.
  assert.match(catalogSource, /OR tm\.kobis_status IN \('matched', 'ambiguous'\)/);
  // 찾아봤지만 없었던 제목은 재시도 기한 전까지 건너뛴다.
  assert.match(catalogSource, /kobis_updated_at <= \?/);
  assert.match(catalogSource, /const THEATER_KOBIS_BATCH_LIMIT = \d+/);
});

test("never marks a movie as provider-checked when only the id was looked up", async () => {
  // getCachedEnrichments가 믿는 값은 'matched'와 'not_found' 뿐이다.
  // id만 아는 행을 'matched'로 적으면, 제공처를 확인한 적이 없는데도
  // 검색 결과가 "구독형에 없음"을 확정으로 말하게 된다.
  const cacheSource = await readFile(
    new URL("../lib/enrichment-cache.ts", import.meta.url),
    "utf8",
  );
  assert.match(cacheSource, /TMDB_ID_ONLY_STATUS = "id_only"/);
  assert.match(cacheSource, /TMDB_ID_NOT_FOUND_STATUS = "id_not_found"/);
  assert.match(
    cacheSource,
    /tmdb_status !== "matched" && movie\.tmdb_status !== "not_found"\) continue/,
  );
  // 미리 채우는 쪽은 그 두 값을 쓰지 않는다.
  assert.match(catalogSource, /TMDB_ID_ONLY_STATUS/);
  assert.doesNotMatch(catalogSource, /SET tmdb_id = \?, tmdb_status = 'matched'/);
});

test("looks up the pre-filled id with the year so remakes cannot be picked", () => {
  // 상세 페이지의 평점·줄거리·제공처가 이 id를 따라간다. 연도 없이 제목만으로
  // 맞추면 같은 제목의 리메이크가 걸려 남의 작품 정보가 뜬다.
  assert.match(
    catalogSource,
    /findTmdbMatch\(\s*target\.title_ko,\s*target\.production_year,\s*target\.title_en,\s*\)/,
  );
  // 이미 id가 있는 행은 덮어쓰지 않는다.
  assert.match(catalogSource, /WHERE movie_cd = \? AND tmdb_id IS NULL/);
  // 끝내 매칭되지 않는 작품이 배치를 독점하지 않도록 한 번도 시도하지 않은 것을 먼저 본다.
  assert.match(catalogSource, /ORDER BY m\.tmdb_updated_at IS NOT NULL/);
});

test("leaves the list card's look alone while pre-filling", () => {
  // 포스터·평점까지 쓰면 목록 카드 겉모습이 바뀐다. 필요한 건 id 하나뿐이다.
  const storeBlock = catalogSource.slice(
    catalogSource.indexOf("async function storeTmdbId"),
    catalogSource.indexOf("export async function syncTheaterMovieTmdbIds"),
  );
  assert.doesNotMatch(storeBlock, /poster_url|vote_average|vote_count/);
});

test("theater posters require the title and the year to match together", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../lib/theater-catalog.ts", import.meta.url), "utf8");
  // 기준 연도는 KOBIS 제작연도가 먼저, 없으면 극장 개봉연도.
  assert.match(source, /const year = target\.production_year \|\| target\.open_date\?\.slice\(0, 4\) \|\| undefined;/);
  assert.match(source, /findTmdbMatch\(target\.title_ko, year\)/);
  // 연도 없이 찾는 것은 재상영 표시를 뗀 제목일 때뿐이다.
  assert.match(source, /stripped \? await findTmdbMatch\(stripped\) : null/);
});

test("ambiguous titles are neither linked nor given a poster from another edition", async () => {
  const releaseSource = await readFile(new URL("../lib/release-catalog.ts", import.meta.url), "utf8");
  // 목록 카드는 같은 제목의 다른 작품 상세에 잇지 않는다(검색으로 보낸다).
  assert.match(releaseSource, /LEFT JOIN movies AS m ON NOT theater_titles\.ambiguous AND/);
  // 그 작품 연도로 찾은 TMDB 포스터를 쓰지 않는다("포스터 준비 중").
  assert.match(releaseSource, /CASE WHEN theater_titles\.ambiguous THEN NULL/);
  // 수집이 편을 정해 둔 제목은 그 편에 잇는다(같은 제목 작품 중 최근작이 아니라).
  assert.match(releaseSource, /m\.movie_cd = COALESCE\(theater_titles\.kobis_movie_cd,/);
  // 포스터 수집도 애매한 제목은 건너뛴다.
  assert.match(catalogSource, /AND kobis_status <> 'ambiguous'/);
  // 상세 화면은 그 작품이 상영 중이라고 단정하지 않는다.
  assert.match(catalogSource, /row\?\.kobis_status === "ambiguous"/);
});

test("never hotlinks theater posters", async () => {
  // 극장사 이미지를 방문자 브라우저가 직접 끌어오면 극장 서버에 부하를 주고,
  // 포스터를 쓸 권리도 없다. 포스터는 TMDB 것만 쓴다.
  const sources = await Promise.all(
    ["../lib/theater-sources.ts", "../lib/release-catalog.ts", "../components/release-poster.tsx"].map((path) =>
      readFile(new URL(path, import.meta.url), "utf8"),
    ),
  );
  for (const source of sources) {
    assert.doesNotMatch(source, /cdn\.cgv\.co\.kr|lottecinema\.co\.kr\/Media|img\.megabox\.co\.kr|theater_poster_url|no-referrer/);
  }
});

function tmdb(id, year, voteCount) {
  return { id, year, posterUrl: `https://image.tmdb.org/t/p/w342/${id}.jpg`, voteCount };
}

test("picks the overwhelmingly popular edition when the theater date cannot tell", () => {
  const candidates = [
    summary("20070070", "시간을 달리는 소녀", "20070705"),
    summary("20119851", "시간을 달리는 소녀", "20110324"),
  ];
  // KOBIS 는 국내 개봉연도(2007)지만 제작연도(2006)로도 맞춘다.
  candidates[0].prdtYear = "2006";
  candidates[1].prdtYear = "2010";
  const picked = pickByPopularity(candidates, "시간을달리는소녀", [tmdb(14069, 2006, 2400), tmdb(54770, 2010, 60)]);
  assert.equal(picked.movie.movieCd, "20070070");
  assert.equal(picked.tmdb.id, 14069);
});

test("does not guess when no edition clearly dominates", () => {
  const candidates = [
    summary("19900001", "같은제목", "19900101"),
    summary("20200001", "같은제목", "20200101"),
  ];
  // 3배가 안 된다.
  assert.equal(pickByPopularity(candidates, "같은제목", [tmdb(1, 1990, 500), tmdb(2, 2020, 200)]), null);
  // 평가가 너무 적다.
  assert.equal(pickByPopularity(candidates, "같은제목", [tmdb(1, 1990, 30), tmdb(2, 2020, 2)]), null);
  // 1등의 연도에 맞는 KOBIS 작품이 없다.
  assert.equal(pickByPopularity(candidates, "같은제목", [tmdb(1, 2005, 900), tmdb(2, 2020, 10)]), null);
  // TMDB 에 같은 제목이 없다.
  assert.equal(pickByPopularity(candidates, "같은제목", []), null);
});

test("stores which edition a theater title points to", () => {
  // 고른 편을 적어 두어야 목록·포스터·상세가 같은 제목의 다른 편으로 새지 않는다.
  assert.match(catalogSource, /linkKobisMovie\(target\.normalized_title, match\.movieCd\)/);
  assert.match(catalogSource, /linkKobisMovie\(target\.normalized_title, popular\.movie\.movieCd\)/);
  assert.match(catalogSource, /linkKobisMovie\(target\.normalized_title, null\)/);
  // 평가 수로 고른 작품도 제공처는 확인하지 않았으므로 'matched' 로 적지 않는다.
  assert.match(catalogSource, /\.bind\(popular\.tmdb\.id, TMDB_ID_ONLY_STATUS, now, popular\.movie\.movieCd\)/);
});
