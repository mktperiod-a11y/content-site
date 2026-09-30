import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeTheaterTitle,
  normalizeTheaterTitle,
  parseCgvCurrentMovies,
  parseLotteMovies,
  parseMegaboxMovies,
  stripScreeningTags,
} from "../lib/theater-sources.ts";

test("decodes HTML entities before a theater title is stored", () => {
  const encoded = "디지몬 어드벤처 : 운명적 만남 &amp; 우리들의 워 게임!";
  const decoded = "디지몬 어드벤처 : 운명적 만남 & 우리들의 워 게임!";
  assert.equal(decodeTheaterTitle(encoded), decoded);

  const payload = {
    totCnt: 1,
    movieList: [
      {
        movieNo: "26057200",
        movieNm: encoded,
        rfilmDe: "20260916",
        movieStatCd: "MSC01",
        bokdAbleYn: "Y",
      },
    ],
  };
  const movie = parseMegaboxMovies(payload, "20260916")[0];
  assert.equal(movie?.titleKo, decoded);
  assert.equal(movie?.normalizedTitle, normalizeTheaterTitle(decoded));
});

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

test("accepts either Megabox booking flag", () => {
  const payload = {
    totCnt: 1,
    movieList: [
      { movieNo: "1", movieNm: "상영작", rfilmDe: "20260902", movieStatCd: "MSC01", bokdAbleYn: "N", bokdAbleAt: "Y" },
    ],
  };
  assert.equal(parseMegaboxMovies(payload, "20260910")[0]?.bookingAvailable, true);
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

test("strips screening-format tags so TMDB can find the underlying film", () => {
  assert.equal(stripScreeningTags("어벤져스-엔드게임 앙코르"), "어벤져스-엔드게임");
  assert.equal(stripScreeningTags("(인피니티비전)어벤져스: 엔드게임 앙코르"), "어벤져스: 엔드게임");
  assert.equal(stripScreeningTags("[응원상영] 킹 오브 프리즘"), "킹 오브 프리즘");
  assert.equal(stripScreeningTags("[더빙] 주토피아 2 (4DX)"), "주토피아 2");
  assert.equal(stripScreeningTags("인터스텔라 IMAX"), "인터스텔라");
});

test("returns null when a title has no screening tag to strip", () => {
  assert.equal(stripScreeningTags("하얼빈"), null);
  assert.equal(stripScreeningTags("귀향-언니야 이제 집에 가자"), null);
  // 떼고 나면 한 글자만 남는 경우도 검색에 쓰지 않는다.
  assert.equal(stripScreeningTags("[더빙] 1"), null);
});
