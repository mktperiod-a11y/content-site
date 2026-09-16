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

const { pickKobisMatch } = await vite.ssrLoadModule("/lib/theater-catalog.ts");
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
  // 기준 날짜가 없으면 가장 최근 개봉작으로 떨어진다.
  assert.equal(pickKobisMatch(candidates, "화양연화", "").movieCd, "20210999");
});

test("returns nothing when KOBIS has no candidate at all", () => {
  assert.equal(pickKobisMatch([], "정체불명의영화", "20250101"), null);
});

test("only asks KOBIS about titles that movies does not already cover", () => {
  // 이미 매칭된 제목까지 다시 물으면 수집할 때마다 쿼터를 그냥 태운다.
  assert.match(
    catalogSource,
    /WHERE NOT EXISTS \(\s*SELECT 1 FROM movies AS m\s*WHERE m\.normalized_title = tm\.normalized_title/,
  );
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
