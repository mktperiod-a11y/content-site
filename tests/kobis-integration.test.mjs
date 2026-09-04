import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildKobisSearchPlans,
  rankKobisMovies,
} from "../lib/kobis.ts";

const kobisSource = await readFile(
  new URL("../lib/kobis.ts", import.meta.url),
  "utf8",
);

test("queries KOBIS separately for titles and directors then merges the results", () => {
  assert.match(kobisSource, /SEARCH_CANDIDATE_LIMIT = 30/);
  assert.match(kobisSource, /buildKobisSearchPlans/);
  assert.match(kobisSource, /new Map<string, KobisMovieSummary>/);
  assert.match(kobisSource, /Promise\.allSettled/);
});

const movie = (movieCd, titleKo, prdtYear, directors = [], titleEn = "") => ({
  movieCd,
  titleKo,
  titleEn,
  prdtYear,
  openDt: "",
  genreAlt: "",
  nationAlt: "",
  directors,
});

test("ranks exact and spacing-insensitive title matches before partial matches", () => {
  const candidates = [
    movie("1", "우리 집에 괴물이 삽니다", "2024", ["홍길동"]),
    movie("2", "괴물", "2006", ["봉준호"]),
    movie("3", "괴물", "2023", ["고레에다 히로카즈"]),
  ];

  assert.deepEqual(
    rankKobisMovies(candidates, "괴물").map(({ movieCd }) => movieCd),
    ["2", "3", "1"],
  );
  assert.equal(
    rankKobisMovies(
      [movie("4", "조제, 호랑이 그리고 물고기들", "2003")],
      "조제호랑이그리고물고기들",
    )[0]?.movieCd,
    "4",
  );
});

test("builds and ranks a combined director and title search", () => {
  assert.ok(
    buildKobisSearchPlans("봉준호 괴물").some(
      (plan) => plan.directorNm === "봉준호" && plan.movieNm === "괴물",
    ),
  );

  const candidates = [
    movie("1", "괴물과 나", "2024", ["홍길동"]),
    movie("2", "괴물", "2006", ["봉준호"]),
  ];
  assert.equal(rankKobisMovies(candidates, "봉준호 괴물")[0]?.movieCd, "2");
});

test("keeps the API key in a server runtime binding", () => {
  assert.match(kobisSource, /KOBIS_API_KEY/);
  assert.doesNotMatch(kobisSource, /d1b0e799/);
});

test("caches repeated searches and detail requests", () => {
  assert.match(kobisSource, /SEARCH_CACHE_TTL_MS/);
  assert.match(kobisSource, /DETAIL_CACHE_TTL_MS/);
  assert.match(kobisSource, /pendingRequests/);
  assert.match(kobisSource, /withCache/);
});
