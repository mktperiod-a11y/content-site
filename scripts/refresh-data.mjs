/**
 * 주간 영화 데이터 수집기.
 *
 * Cloudflare Worker의 크론이 하던 일을 GitHub Actions에서 그대로 돌린다.
 * 빌드된 워커(dist/server/index.js)를 그대로 불러 /api/releases/refresh 를
 * 호출하므로, 수집 로직은 운영 코드와 한 벌이다. 이 스크립트가 따로 하는
 * 일은 D1 대신 로컬 SQLite를 물려주고, 끝난 뒤 결과를 JSON으로 떠서
 * 저장소에 남기는 것뿐이다.
 *
 * 필요한 환경변수: KOBIS_API_KEY, TMDB_API_KEY
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = join(ROOT, "data", "catalog.json");

// 수집 결과를 주 단위로 이어붙이기 위해 저장해두는 표.
// sync_state 는 일부러 제외한다 — 지난 실행의 성공 시각이 남아 있으면
// 이번 주 실행이 "아직 신선하다"며 건너뛰기 때문이다.
const PERSISTED = ["movies", "theater_movies", "movie_providers"];

function openDatabase() {
  const sql = new DatabaseSync(":memory:");
  const dir = join(ROOT, "drizzle");
  for (const file of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) sql.exec(trimmed);
    }
  }
  return sql;
}

function columnsOf(sql, table) {
  return sql.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

/** 지난 주 결과를 되살린다. 이미 맞춰둔 TMDB 매칭을 다시 부르지 않아 호출량이 준다. */
function restore(sql) {
  if (!existsSync(CATALOG)) return 0;
  let restored = 0;
  const saved = JSON.parse(readFileSync(CATALOG, "utf8"));
  for (const table of PERSISTED) {
    const rows = saved.tables?.[table] ?? [];
    if (rows.length === 0) continue;
    const columns = columnsOf(sql, table);
    const usable = columns.filter((c) => c in rows[0]);
    const insert = sql.prepare(
      `INSERT OR IGNORE INTO ${table} (${usable.join(",")}) VALUES (${usable.map(() => "?").join(",")})`,
    );
    for (const row of rows) insert.run(...usable.map((c) => row[c] ?? null));
    restored += rows.length;
  }
  return restored;
}

function dump(sql) {
  const tables = {};
  for (const table of PERSISTED) {
    // 커밋 diff가 실행 순서에 따라 흔들리지 않도록 항상 같은 기준으로 정렬한다.
    const key = columnsOf(sql, table)[0];
    tables[table] = sql.prepare(`SELECT * FROM ${table} ORDER BY ${key}`).all();
  }
  return tables;
}

function requireKeys() {
  const missing = ["KOBIS_API_KEY", "TMDB_API_KEY"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      `필요한 시크릿이 없습니다: ${missing.join(", ")}\n` +
        "저장소 Settings > Secrets and variables > Actions 에 등록해주세요.",
    );
    process.exit(1);
  }
}

requireKeys();

/**
 * 수집을 시작하기 전에 키가 실제로 받아들여지는지 확인한다.
 * 401이 나면 수집은 형식상 성공하면서 결과만 비는데, 그 상태로는
 * 로그를 끝까지 읽어야 원인을 알 수 있다.
 */
/**
 * 수집을 시작하기 전에 키가 실제로 받아들여지는지 확인한다.
 * 401이 나면 수집은 형식상 성공하면서 결과만 비는데, 그 상태로는
 * 로그를 끝까지 읽어야 원인을 알 수 있다.
 *
 * 다만 여기서 막는 것은 "키가 거부됐다"는 경우뿐이다. 응답이 늦거나
 * 연결이 끊기는 것은 수집 단계가 재시도로 넘기므로, 확인에 실패했다고
 * 해서 실행을 접지는 않는다.
 */
async function checkKey(name, url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch (error) {
    console.warn(`${name} 키 확인을 건너뜁니다 (${error.name === "TimeoutError" ? "응답 지연" : error.message}).`);
    return null;
  }
  if (!res.ok) return `${name}: HTTP ${res.status}`;
  // KOBIS 는 키가 틀려도 200 으로 답하고 본문에 faultInfo 를 담는다.
  try {
    const json = await res.json();
    if (json && typeof json === "object" && "faultInfo" in json) {
      return `${name}: ${json.faultInfo?.message ?? "키가 거부됨"}`;
    }
  } catch {
    return `${name}: 응답을 해석할 수 없음`;
  }
  console.log(`${name} 키 확인 완료.`);
  return null;
}

async function preflight() {
  const kobisBase = process.env.KOBIS_API_BASE || "https://www.kobis.or.kr/kobisopenapi/webservice/rest";
  const tmdbBase = process.env.TMDB_API_BASE || "https://api.themoviedb.org/3";
  const failures = (
    await Promise.all([
      // 목록 조회는 무거우므로 한 건만 요청해 키 유효성만 본다.
      checkKey("KOBIS", `${kobisBase}/movie/searchMovieList.json?key=${encodeURIComponent(process.env.KOBIS_API_KEY)}&itemPerPage=1`),
      checkKey("TMDB", `${tmdbBase}/configuration?api_key=${encodeURIComponent(process.env.TMDB_API_KEY)}`),
    ])
  ).filter(Boolean);

  if (failures.length === 0) return;

  console.error(`키가 거부됐습니다 — ${failures.join(", ")}`);
  if (failures.some((f) => f.startsWith("TMDB"))) {
    console.error(
      "TMDB 키를 확인해주세요. v4 읽기 토큰(eyJ... 로 시작하는 긴 문자열)이 아니라\n" +
        "v3 API Key(32자리 영숫자)를 TMDB_API_KEY 시크릿에 넣어야 합니다.\n" +
        "TMDB 사이트의 설정 > API 화면에서 'API Key' 항목입니다.",
    );
  }
  if (failures.some((f) => f.startsWith("KOBIS"))) {
    console.error("KOBIS 키 발급 상태와 일일 한도를 확인해주세요.");
  }
  process.exit(1);
}

await preflight();

const sql = openDatabase();
const restored = restore(sql);
console.log(`이전 결과 ${restored}행을 복원했습니다.`);

const prepare = (query) => {
  let bound = [];
  const api = {
    bind: (...args) => { bound = args; return api; },
    all: async () => ({ results: sql.prepare(query).all(...bound) }),
    first: async () => sql.prepare(query).get(...bound) ?? null,
    run: async () => { sql.prepare(query).run(...bound); return {}; },
  };
  return api;
};
const db = { prepare, batch: async (statements) => Promise.all(statements.map((s) => s.run())) };
globalThis.__WHERE_TO_WATCH_DB__ = db;

const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url).href);

const started = Date.now();
const response = await worker.fetch(
  new Request("http://localhost/api/releases/refresh", { method: "POST" }),
  { ASSETS: { fetch: async () => new Response("not found", { status: 404 }) }, DB: db },
  { waitUntil() {}, passThroughOnException() {} },
);
const body = await response.text();
console.log(`수집 응답 ${response.status} (${((Date.now() - started) / 1000).toFixed(1)}초): ${body.slice(0, 600)}`);

const tables = dump(sql);
const counts = Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length]));
console.log("수집 결과:", counts);

if (tables.movies.length === 0) {
  console.error("영화가 한 편도 수집되지 않았습니다. 키 값 또는 외부 API 상태를 확인해주세요.");
  process.exit(1);
}

/**
 * 한 단계가 조회한 건마다 모두 실패했다면 일시적인 오류가 아니다.
 * 이런 실행은 영화 목록만 채워진 채 성공으로 끝나기 쉬워서, 여기서 막는다.
 * 극장사 한 곳이 막히는 것처럼 일부만 실패하는 경우는 통과시킨다.
 */
const wipedOut = [];
try {
  const report = JSON.parse(body);
  for (const [step, value] of Object.entries(report)) {
    if (value && typeof value === "object" && typeof value.checked === "number") {
      if (value.checked > 0 && value.errors === value.checked) {
        wipedOut.push(`${step} (${value.checked}건 전부 실패)`);
      }
    }
  }
} catch {
  console.warn("수집 응답을 해석하지 못해 단계별 점검을 건너뜁니다.");
}
if (wipedOut.length > 0) {
  console.error(`다음 단계가 전부 실패했습니다: ${wipedOut.join(", ")}`);
  console.error("외부 API 키 또는 한도 문제일 가능성이 높습니다. 위 로그의 오류를 확인해주세요.");
  process.exit(1);
}

/**
 * 통째로 실패한 단계를 찾는다. 응답에서 null 인 항목은 그 수집이
 * 예외로 끝났다는 뜻이다. 앞선 실행에서 개봉작 수집이 이렇게 죽었는데도
 * 극장 정보만으로 결과가 채워져 성공으로 끝났다.
 */
const missing = [];
try {
  const report = JSON.parse(body);
  for (const [step, value] of Object.entries(report)) {
    if (value === null) missing.push(step);
  }
  // 극장사 한 곳이 막히는 일은 드물지 않다(CGV 는 계속 403 이다). 그때마다
  // 실행을 빨간불로 만들면 경고가 무뎌지므로, 전부 막혔을 때만 실패로 본다.
  const chains = report.theaters?.results ?? [];
  const blocked = chains.filter((chain) => chain.reason === "source_error");
  if (blocked.length > 0 && blocked.length < chains.length) {
    console.warn(`일부 극장사를 읽지 못했습니다: ${blocked.map((c) => c.code).join(", ")}`);
  } else if (blocked.length > 0) {
    missing.push(`극장 전체 (${blocked.map((c) => c.code).join(", ")})`);
  }
} catch {
  /* 위에서 이미 알렸다 */
}

mkdirSync(join(ROOT, "data"), { recursive: true });
writeFileSync(
  CATALOG,
  JSON.stringify({ generatedAt: new Date().toISOString(), counts, tables }, null, 2) + "\n",
);
console.log(`data/catalog.json 을 갱신했습니다.`);

if (response.status >= 400) process.exit(1);

if (missing.length > 0) {
  // 받아온 만큼은 남겨야 하므로 저장을 마친 뒤에 알린다.
  // 종료 코드 2는 워크플로가 "일부 실패"로 구분해 읽는다.
  console.error(`수집하지 못한 항목이 있습니다: ${missing.join(", ")}`);
  process.exit(2);
}
