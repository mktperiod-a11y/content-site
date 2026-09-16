import assert from "node:assert/strict";
import test from "node:test";

/**
 * /api/movies/enrich는 로그인 없이 열려 있고, 여기로 들어온 항목은 movies 테이블에
 * 저장된다. movies는 "개봉 예정작" 목록과 sitemap.xml의 원본이라, KOBIS 결과의
 * 모양이 아닌 값이 저장되면 없는 작품이 목록과 사이트맵에 실린다.
 */

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

/** D1 대신 실행된 SQL만 기록하는 스텁. 저장이 일어났는지만 확인한다. */
function createDbSpy() {
  const executed = [];
  const statement = (sql) => ({
    bind: () => statement(sql),
    all: async () => ({ results: [] }),
    first: async () => null,
    run: async () => ({}),
  });
  return {
    executed,
    db: {
      prepare: (sql) => {
        executed.push(sql.replace(/\s+/g, " ").trim());
        return statement(sql);
      },
      batch: async () => [],
    },
  };
}

async function postItems(items) {
  const worker = await loadWorker();
  const { executed, db } = createDbSpy();
  const response = await worker.fetch(
    new Request("http://localhost/api/movies/enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      DB: db,
    },
    { waitUntil() {}, passThroughOnException() {} },
  );

  return {
    status: response.status,
    body: await response.json(),
    wroteMovies: executed.some((sql) => sql.startsWith("INSERT INTO movies")),
  };
}

test("drops enrichment items that do not look like KOBIS records", async () => {
  const result = await postItems([
    { movieCd: "'; DROP TABLE movies; --", titleKo: "가짜 개봉작", openDate: "20991231" },
    { movieCd: "20250003", titleKo: "연도가 이상함", year: "99999" },
    { movieCd: "20250004", titleKo: "개봉일이 이상함", openDate: "2026-01-01" },
    { movieCd: "20250005", titleKo: "제목이 너무 김".repeat(40) },
    "문자열",
    null,
  ]);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.movies, []);
  assert.equal(result.wroteMovies, false);
});

test("keeps the shapes KOBIS actually returns", async () => {
  const result = await postItems([
    { movieCd: "20241234", titleKo: "하얼빈", titleEn: "Harbin", year: "2024", openDate: "20241224" },
    // 연도·개봉일이 비어 있는 작품도 KOBIS 검색 결과에 그대로 섞여 나온다.
    { movieCd: "20250001", titleKo: "미정", titleEn: "", year: "", openDate: "" },
    // 가격 비교 탭은 선택 항목을 생략한 채 보내기도 한다.
    { movieCd: "20250002", titleKo: "옵션 없음" },
  ]);

  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body.movies.map((movie) => movie.movieCd),
    ["20241234", "20250001", "20250002"],
  );
});

test("rejects a body whose items are not an array", async () => {
  const result = await postItems("not-an-array");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.movies, []);
  assert.equal(result.wroteMovies, false);
});
