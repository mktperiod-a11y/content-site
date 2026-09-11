import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTheaterTitle,
  parseCgvCurrentMovies,
  parseLotteMovies,
  parseMegaboxMovies,
} from "../lib/theater-sources.ts";

test("normalizes spacing and punctuation differences across theater chains", () => {
  assert.equal(
    normalizeTheaterTitle("스파이더맨- 브랜드 뉴 데이?"),
    normalizeTheaterTitle("스파이더맨: 브랜드 뉴 데이"),
  );
});

test("reads every movie in CGV's current-playing tab only", () => {
  const payload = {
    data: {
      tabs: [
        { tabExpoNm: "무비차트", movctSearchResDtoList: [{ movNo: "x", movNm: "제외" }] },
        {
          tabExpoNm: "현재상영작",
          movctSearchResDtoList: [
            { movNo: "1", movNm: "싱 어게인", realOpenYmd: "20260902", atktPsblYn: "Y" },
            { movNo: "2", movNm: "오디세이", rlsYmd: "20260805", atktPsblYn: "N" },
          ],
        },
      ],
    },
  };
  assert.deepEqual(parseCgvCurrentMovies(payload).map((movie) => movie.titleKo), [
    "싱 어게인",
    "오디세이",
  ]);
});

test("keeps Megabox current releases and removes future titles", () => {
  const payload = {
    totCnt: 2,
    movieList: [
      { movieNo: "1", movieNm: "싱 어게인", rfilmDe: "20260902", movieStatCd: "MSC01", bokdAbleYn: "Y" },
      { movieNo: "2", movieNm: "다음 주 영화", rfilmDe: "20260916", movieStatCd: "MSC01", bokdAbleYn: "Y" },
    ],
  };
  assert.deepEqual(parseMegaboxMovies(payload, "20260910").map((movie) => movie.titleKo), [
    "싱 어게인",
  ]);
});

test("removes Lotte ads, ended titles, and future titles", () => {
  const payload = {
    Movies: {
      Items: [
        { RepresentationMovieCode: "", MovieNameKR: "AD", ReleaseDate: null },
        { RepresentationMovieCode: "1", MovieNameKR: "상영작", ReleaseDate: "2026-09-02 오전 12:00:00", MoviePlayYN: "Y", MoviePlayEndYN: "N", BookingYN: "Y" },
        { RepresentationMovieCode: "2", MovieNameKR: "종영작", ReleaseDate: "2026-09-01 오전 12:00:00", MoviePlayYN: "Y", MoviePlayEndYN: "Y", BookingYN: "N" },
      ],
    },
  };
  assert.deepEqual(parseLotteMovies(payload, "20260910").map((movie) => movie.titleKo), [
    "상영작",
  ]);
});
