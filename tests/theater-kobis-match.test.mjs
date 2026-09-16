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
