/**
 * 영화 데이터 수집기. GitHub Actions 에서 매일 돈다(.github/workflows/refresh-data.yml).
 *
 * 수집 규칙을 따로 옮겨 적지 않는다. 빌드된 워커(dist/server/index.js)를 불러
 * 운영과 같은 코드로 /api/releases/refresh 와 상세 화면을 호출하고, D1 자리에는
 * 로컬 SQLite 를 끼워 준다. Cloudflare 무료 플랜의 워커는 요청 한 번에 외부
 * 호출을 50번까지만 할 수 있어, 무거운 수집은 제한이 없는 여기서 끝낸다.
 *
 * 흐름
 *   1. 키 확인       KOBIS·TMDB 가 키를 거부하면 바로 멈춘다
 *   2. 출발점 복원    data/catalog.json 과 운영 D1 의 현재 내용을 가져온다
 *   3. 수집          /api/releases/refresh (개봉작·극장 상영작·포스터·매칭)
 *   4. 점검          여러 건이 전부 실패한 단계가 있으면 멈추고, 일부 실패는 기록한다
 *   5. 저장 ①        수집 결과를 운영 D1 에 먼저 반영한다
 *   6. 상세 미리 받기 1탭 영화의 상세를 시간 예산 안에서 열어 보관한다
 *   7. 저장 ②        미리 받은 상세를 반영하고 data/catalog.json 을 남긴다
 *
 * 종료 코드: 0 성공, 1 실패(저장 안 함), 2 일부 실패(받은 만큼은 저장함)
 *
 * 환경변수
 *   KOBIS_API_KEY, TMDB_API_KEY   필수
 *   D1_CONFIG                      운영 D1 과 주고받을 wrangler 설정 경로. 없으면 D1 연동을 건너뛴다
 *   D1_TARGET=local, D1_PERSIST    시험용: 로컬 D1 을 대상으로 한다
 *   PREFETCH_BUDGET_MS             시험용: 상세 미리 받기 시간 예산(기본 5분)
 */
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = join(ROOT, "data", "catalog.json");

/**
 * 실행과 실행 사이에 이어 가는 표. data/catalog.json 에 남기고 운영 D1 과 주고받는다.
 * sync_state 는 넣지 않는다 — 지난 실행의 성공 시각이 남으면 이번 실행이 "아직
 * 신선하다"며 건너뛴다. 개봉작 목록의 수집 시각만 따로 가져온다(2단계).
 */
const PERSISTED = ["movies", "theater_movies", "movie_providers"];

const D1_CONFIG = process.env.D1_CONFIG;
const D1_NAME = process.env.D1_NAME || "moviesiso";
const D1_TARGET = process.env.D1_TARGET === "local" ? "local" : "remote";

const PREFETCH_LIMIT = 300;
const PREFETCH_CONCURRENCY = 4;
const PREFETCH_BUDGET_MS = Number(process.env.PREFETCH_BUDGET_MS) || 5 * 60 * 1000;
/** 화면은 36시간까지 보관본을 쓰지만, 매일 도는 수집기는 이보다 오래된 TMDB 응답을 새로 받는다. */
const TMDB_REFETCH_AFTER_MS = 20 * 60 * 60 * 1000;

// ─── 로컬 SQLite ─────────────────────────────────────────────────────────────

function openDatabase() {
  const sql = new DatabaseSync(":memory:");
  const dir = join(ROOT, "drizzle");
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) sql.exec(trimmed);
    }
  }
  return sql;
}

function columnsOf(sql, table) {
  return sql.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

/**
 * 행들을 로컬 표에 넣는다. 로컬 표에 없는 열은 무시한다.
 * replace=false 면 이미 있는 행을 그대로 두고, overrides 는 열 값을 바꿔 넣는다.
 */
function loadRows(sql, table, rows, { replace = true, overrides = {} } = {}) {
  if (rows.length === 0) return 0;
  const columns = columnsOf(sql, table).filter((column) => column in rows[0]);
  const insert = sql.prepare(
    `INSERT OR ${replace ? "REPLACE" : "IGNORE"} INTO ${table} (${columns.join(",")})
     VALUES (${columns.map(() => "?").join(",")})`,
  );
  for (const row of rows) {
    insert.run(...columns.map((column) => (column in overrides ? overrides[column] : (row[column] ?? null))));
  }
  return rows.length;
}

/** 커밋 diff 가 실행 순서에 따라 흔들리지 않도록 항상 첫 열 기준으로 정렬한다. */
function dump(sql) {
  const tables = {};
  for (const table of PERSISTED) {
    tables[table] = sql.prepare(`SELECT * FROM ${table} ORDER BY ${columnsOf(sql, table)[0]}`).all();
  }
  return tables;
}

/** 빌드된 워커가 쓰는 D1 바인딩 모양을 로컬 SQLite 위에 흉내 낸다. */
function createD1Binding(sql) {
  const prepare = (query) => {
    let bound = [];
    const statement = {
      bind: (...args) => {
        bound = args;
        return statement;
      },
      all: async () => ({ results: sql.prepare(query).all(...bound) }),
      first: async () => sql.prepare(query).get(...bound) ?? null,
      run: async () => {
        sql.prepare(query).run(...bound);
        return {};
      },
    };
    return statement;
  };
  return { prepare, batch: async (statements) => Promise.all(statements.map((s) => s.run())) };
}

function seoulDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000))
    .reduce((acc, part) => ((acc[part.type] = part.value), acc), {});
  return `${parts.year}${parts.month}${parts.day}`;
}

// ─── 운영 D1 ─────────────────────────────────────────────────────────────────

function wranglerD1(args) {
  const persist = D1_TARGET === "local" && process.env.D1_PERSIST ? ["--persist-to", process.env.D1_PERSIST] : [];
  return execFileSync(
    "npx",
    ["wrangler", "d1", "execute", D1_NAME, `--${D1_TARGET}`, "--config", D1_CONFIG, ...persist, ...args],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] },
  );
}

function readD1Rows(query) {
  const out = wranglerD1(["--json", "--command", query]);
  // wrangler 가 JSON 앞뒤에 안내 문구를 붙이는 경우가 있어 배열 부분만 떼어 읽는다.
  return JSON.parse(out.slice(out.indexOf("[")))[0]?.results ?? [];
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertRowsSql(table, rows, columns) {
  return rows.map(
    (row) =>
      `INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES (${columns.map((c) => sqlLiteral(row[c])).join(",")});`,
  );
}

function runSqlOnD1(lines) {
  if (lines.length === 0) return 0;
  const file = join(tmpdir(), `moviesiso-d1-${Date.now()}.sql`);
  writeFileSync(file, lines.join("\n") + "\n");
  try {
    wranglerD1(["--file", file, "--yes"]);
  } finally {
    rmSync(file, { force: true });
  }
  return lines.length;
}

/** 저장 ①: 수집 결과(개봉작·극장 상영작·포스터·매칭)를 반영하는 문장. */
function collectedSql(sql, tables) {
  const lines = [];
  for (const table of PERSISTED) {
    lines.push(...insertRowsSql(table, tables[table], columnsOf(sql, table)));
  }
  // 내려간 상영작을 지운다. 이번에 목록이 있는 극장사만 정리하고, 목록을 받아오지
  // 못한 극장사(예: CGV 가 403 일 때)의 행은 D1 에 있는 그대로 둔다.
  const idsByChain = new Map();
  for (const row of tables.theater_movies) {
    if (!idsByChain.has(row.theater_code)) idsByChain.set(row.theater_code, []);
    idsByChain.get(row.theater_code).push(row.theater_movie_id);
  }
  for (const [code, ids] of idsByChain) {
    lines.push(
      `DELETE FROM theater_movies WHERE theater_code = ${sqlLiteral(code)} AND theater_movie_id NOT IN (${ids.map(sqlLiteral).join(",")});`,
    );
  }
  // 이번에 개봉작 목록을 새로 받았다면 사이트도 그 시각을 알게 한다.
  const release = sql.prepare("SELECT last_success_at FROM sync_state WHERE sync_key = 'release_catalog'").get();
  if (release?.last_success_at) {
    lines.push(
      `UPDATE sync_state SET last_success_at = MAX(COALESCE(last_success_at, 0), ${Number(release.last_success_at)}), updated_at = ${Date.now()} WHERE sync_key = 'release_catalog';`,
    );
  }
  return lines;
}

/**
 * 저장 ②: 상세 미리 받기 동안 바뀐 행만 반영하는 문장. 보관함은 새로 받은 행만
 * 보내 수 MB 를 매번 다시 쓰지 않는다. 상세 화면이 제공처를 새로 저장한 영화는
 * 제공처를 영화 단위로 지우고 다시 넣는다(persistEnrichment 와 같은 방식).
 */
function prefetchedSql(sql, since) {
  const lines = [];
  const details = sql
    .prepare("SELECT * FROM detail_cache WHERE kobis_fetched_at >= ? OR tmdb_fetched_at >= ?")
    .all(since, since);
  lines.push(...insertRowsSql("detail_cache", details, columnsOf(sql, "detail_cache")));
  const movies = sql.prepare("SELECT * FROM movies WHERE updated_at >= ? OR tmdb_updated_at >= ?").all(since, since);
  lines.push(...insertRowsSql("movies", movies, columnsOf(sql, "movies")));
  const providerColumns = columnsOf(sql, "movie_providers");
  const providersOf = sql.prepare("SELECT * FROM movie_providers WHERE movie_cd = ?");
  for (const movie of movies) {
    if (movie.tmdb_status !== "matched") continue;
    lines.push(`DELETE FROM movie_providers WHERE movie_cd = ${sqlLiteral(movie.movie_cd)};`);
    lines.push(...insertRowsSql("movie_providers", providersOf.all(movie.movie_cd), providerColumns));
  }
  return lines;
}

// ─── 1. 키 확인 ──────────────────────────────────────────────────────────────

/**
 * 키가 거부되면 수집은 형식상 성공하면서 결과만 비고, 원인은 로그 끝에 묻힌다.
 * 여기서 막는 것은 "키가 거부됐다"는 경우뿐이다. 응답 지연이나 연결 끊김은 수집
 * 단계가 다시 시도하므로 이것 때문에 실행을 접지는 않는다.
 */
async function checkKey(name, url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
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

async function checkKeys() {
  const missingKeys = ["KOBIS_API_KEY", "TMDB_API_KEY"].filter((name) => !process.env[name]);
  if (missingKeys.length > 0) {
    console.error(
      `필요한 시크릿이 없습니다: ${missingKeys.join(", ")}\n` +
        "저장소 Settings > Secrets and variables > Actions 에 등록해주세요.",
    );
    process.exit(1);
  }

  const kobisBase = process.env.KOBIS_API_BASE || "https://www.kobis.or.kr/kobisopenapi/webservice/rest";
  const tmdbBase = process.env.TMDB_API_BASE || "https://api.themoviedb.org/3";
  const rejected = (
    await Promise.all([
      // 목록 조회는 무거우므로 한 건만 요청해 키가 받아들여지는지만 본다.
      checkKey("KOBIS", `${kobisBase}/movie/searchMovieList.json?key=${encodeURIComponent(process.env.KOBIS_API_KEY)}&itemPerPage=1`),
      checkKey("TMDB", `${tmdbBase}/configuration?api_key=${encodeURIComponent(process.env.TMDB_API_KEY)}`),
    ])
  ).filter(Boolean);
  if (rejected.length === 0) return;

  console.error(`키가 거부됐습니다 — ${rejected.join(", ")}`);
  if (rejected.some((reason) => reason.startsWith("TMDB"))) {
    console.error(
      "TMDB 키를 확인해주세요. v4 읽기 토큰(eyJ... 로 시작하는 긴 문자열)이 아니라\n" +
        "v3 API Key(32자리 영숫자)를 TMDB_API_KEY 시크릿에 넣어야 합니다.\n" +
        "TMDB 사이트의 설정 > API 화면에서 'API Key' 항목입니다.",
    );
  }
  if (rejected.some((reason) => reason.startsWith("KOBIS"))) {
    console.error("KOBIS 키 발급 상태와 일일 한도를 확인해주세요.");
  }
  process.exit(1);
}

await checkKeys();

// ─── 2. 출발점 복원 ──────────────────────────────────────────────────────────

const sql = openDatabase();

// 지난 실행 결과. 이미 맞춰 둔 매칭을 다시 조회하지 않아 호출량이 준다.
if (existsSync(CATALOG)) {
  const saved = JSON.parse(readFileSync(CATALOG, "utf8"));
  let restored = 0;
  for (const table of PERSISTED) {
    restored += loadRows(sql, table, saved.tables?.[table] ?? [], { replace: false });
  }
  console.log(`이전 결과 ${restored}행을 복원했습니다.`);
}

if (D1_CONFIG) {
  // 운영 D1 이 기준이다. 사이트에서 상세를 열 때 새로 저장된 정보까지 가져와야,
  // 저장할 때 그 정보를 덮어쓰지 않는다.
  let fromD1 = 0;
  for (const table of PERSISTED) {
    fromD1 += loadRows(sql, table, readD1Rows(`SELECT * FROM ${table}`));
  }
  console.log(`운영 D1(${D1_TARGET})에서 ${fromD1}행을 가져왔습니다.`);

  // 상세 보관함. KOBIS 작품 정보는 7일 동안 다시 받지 않아도 된다.
  // 표가 아직 없으면(마이그레이션 전) 조용히 넘어간다.
  try {
    const details = loadRows(sql, "detail_cache", readD1Rows("SELECT * FROM detail_cache"));
    console.log(`상세 보관함 ${details}건을 가져왔습니다.`);
  } catch {
    console.warn("운영 D1 에 상세 보관함이 아직 없습니다. 먼저 'Cloudflare 배포'로 표를 만들어주세요.");
  }

  // 개봉작 목록은 7일마다 받는 설계다. 사이트가 최근에 받아 뒀다면 그 시각을 가져와
  // 건너뛰게 한다. 그러지 않으면 실행마다 KOBIS 목록 수백 건을 새로 받는다.
  const release = readD1Rows("SELECT * FROM sync_state WHERE sync_key = 'release_catalog'");
  loadRows(sql, "sync_state", release, { overrides: { lock_until: 0, lock_token: null } });
  if (release.length) {
    const at = release[0].last_success_at;
    console.log(`개봉작 목록 마지막 수집: ${at ? new Date(at).toISOString() : "없음"}`);
  }
}

// 사이트 안의 수집은 무료 플랜의 외부 호출 한도 탓에 실패한 건을 '오류'로 남기고,
// 앱은 그런 건을 포스터 30일·매칭 7일 동안 다시 시도하지 않는다. 한도 탓이라 기다릴
// 이유가 없으므로 이 수집기 안에서만 대기 표시를 풀어 바로 다시 시도한다.
// 포스터 '찾을 수 없음'도 매일 다시 본다 — 제목 규칙이 나아지면 바로 잡히고,
// 대상은 포스터 없는 상영작뿐이라 하루 수십 건이다. 앱의 재시도 규칙은 그대로 둔다.
console.log("멈춰 있던 건을 다시 시도합니다:", {
  posters: sql
    .prepare("UPDATE theater_movies SET tmdb_status = 'pending' WHERE poster_url IS NULL AND tmdb_status IN ('error', 'not_found')")
    .run().changes,
  kobis: sql.prepare("UPDATE theater_movies SET kobis_status = 'pending' WHERE kobis_status = 'error'").run().changes,
  tmdbIds: sql
    .prepare("UPDATE movies SET tmdb_updated_at = NULL WHERE tmdb_id IS NULL AND tmdb_status = 'id_error'")
    .run().changes,
});

// ─── 3. 수집 ─────────────────────────────────────────────────────────────────

const db = createD1Binding(sql);
globalThis.__WHERE_TO_WATCH_DB__ = db;
const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url).href);
const WORKER_ENV = { ASSETS: { fetch: async () => new Response("not found", { status: 404 }) }, DB: db };
const WORKER_CTX = { waitUntil() {}, passThroughOnException() {} };
const callWorker = (path, init) => worker.fetch(new Request(`http://localhost${path}`, init), WORKER_ENV, WORKER_CTX);

const collectStarted = Date.now();
const response = await callWorker("/api/releases/refresh", { method: "POST" });
const body = await response.text();
console.log(`수집 응답 ${response.status} (${((Date.now() - collectStarted) / 1000).toFixed(1)}초): ${body.slice(0, 600)}`);

const tables = dump(sql);
console.log("수집 결과:", Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])));

// ─── 4. 점검 ─────────────────────────────────────────────────────────────────

if (tables.movies.length === 0) {
  console.error("영화가 한 편도 수집되지 않았습니다. 키 값 또는 외부 API 상태를 확인해주세요.");
  process.exit(1);
}
if (response.status >= 400) process.exit(1);

let report = null;
try {
  report = JSON.parse(body);
} catch {
  console.warn("수집 응답을 해석하지 못해 단계별 점검을 건너뜁니다.");
}

// 여러 건이 하나도 빠짐없이 실패한 단계는 일시적인 오류가 아니다. 영화 목록만 채워진
// 채 성공으로 끝나기 쉬워 여기서 멈춘다. 한두 건의 실패는 넘긴다(키 문제는 1단계에서 걸렀다).
const wipedOut = Object.entries(report ?? {})
  .filter(([, value]) => typeof value?.checked === "number" && value.checked >= 5 && value.errors === value.checked)
  .map(([step, value]) => `${step} (${value.checked}건 전부 실패)`);
if (wipedOut.length > 0) {
  console.error(`다음 단계가 전부 실패했습니다: ${wipedOut.join(", ")}`);
  console.error("외부 API 키 또는 한도 문제일 가능성이 높습니다. 위 로그의 오류를 확인해주세요.");
  process.exit(1);
}

// 일부 실패는 기록만 하고 받은 만큼 저장한 뒤 종료 코드 2로 알린다.
// null 인 항목은 그 수집이 예외로 끝났다는 뜻이다.
const incomplete = Object.entries(report ?? {})
  .filter(([, value]) => value === null)
  .map(([step]) => step);
// 극장사 한 곳이 막히는 일은 흔하다(CGV 가 자주 403). 그때마다 실패로 표시하면
// 경고가 무뎌지므로, 세 곳이 모두 막혔을 때만 기록한다.
const chains = report?.theaters?.results ?? [];
const blocked = chains.filter((chain) => chain.reason === "source_error").map((chain) => chain.code);
if (blocked.length > 0 && blocked.length === chains.length) incomplete.push(`극장 전체 (${blocked.join(", ")})`);
else if (blocked.length > 0) console.warn(`일부 극장사를 읽지 못했습니다: ${blocked.join(", ")}`);

// ─── 5. 저장 ① ───────────────────────────────────────────────────────────────

// 상세 미리 받기보다 먼저 저장한다. 미리 받기가 느려지거나 멈춰도 포스터·상영작·
// 매칭 결과는 이미 사이트에 반영돼 있게 하기 위해서다.
if (D1_CONFIG) {
  const statements = runSqlOnD1(collectedSql(sql, tables));
  console.log(`운영 D1(${D1_TARGET})에 수집 결과를 ${statements}개 문장으로 반영했습니다.`);
}

// ─── 6. 상세 미리 받기 ───────────────────────────────────────────────────────

/*
 * 1탭 영화(지금 상영작 + 120일 안 개봉 예정작)의 상세 화면을 미리 한 번씩 연다.
 * 상세 화면은 받은 KOBIS·TMDB 응답을 detail_cache 에 넣으므로, 여기서 연 만큼
 * 방문자는 외부를 기다리지 않는다.
 *
 * 끝까지 기다리지 않는다. 시간 예산 안에 연 만큼만 저장하고, 남은 것은 다음 날
 * 받거나 방문자가 처음 열 때 받아 보관된다. KOBIS 는 짧게만 기다리고 다시 시도하지
 * 않아, 느린 작품 하나가 전체를 붙잡지 않게 한다.
 */
process.env.KOBIS_TIMEOUT_MS = "6000";
process.env.KOBIS_RETRIES = "0";
const prefetchStarted = Date.now();

// 사람들이 많이 여는 지금 상영작을 먼저(최근 개봉순), 개봉 예정작은 그다음(가까운 순).
const targets = sql
  .prepare(
    `SELECT movie_cd FROM (
       SELECT m.movie_cd, m.open_date, 0 AS priority FROM movies AS m
       WHERE EXISTS (SELECT 1 FROM theater_movies AS tm WHERE tm.normalized_title = m.normalized_title)
       UNION
       SELECT u.movie_cd, u.open_date, 1 AS priority FROM movies AS u
       WHERE u.open_date > ? AND u.open_date <= ?
         AND NOT EXISTS (SELECT 1 FROM theater_movies AS tm WHERE tm.normalized_title = u.normalized_title)
     )
     ORDER BY priority,
              CASE WHEN priority = 0 THEN -CAST(open_date AS INTEGER) ELSE CAST(open_date AS INTEGER) END
     LIMIT ?`,
  )
  .all(seoulDate(0), seoulDate(120), PREFETCH_LIMIT)
  .map((row) => row.movie_cd);

sql.prepare("UPDATE detail_cache SET tmdb_fetched_at = NULL WHERE tmdb_fetched_at < ?").run(
  Date.now() - TMDB_REFETCH_AFTER_MS,
);

let opened = 0;
let failed = 0;
for (let index = 0; index < targets.length; index += PREFETCH_CONCURRENCY) {
  if (Date.now() - prefetchStarted > PREFETCH_BUDGET_MS) break;
  const batch = targets.slice(index, index + PREFETCH_CONCURRENCY);
  opened += batch.length;
  await Promise.all(
    batch.map(async (movieCd) => {
      try {
        const res = await callWorker(`/movie/${encodeURIComponent(movieCd)}`);
        await res.arrayBuffer();
        if (!res.ok) failed += 1;
      } catch {
        failed += 1;
      }
    }),
  );
}

const fetched = sql
  .prepare("SELECT count(*) AS n FROM detail_cache WHERE kobis_fetched_at >= ? OR tmdb_fetched_at >= ?")
  .get(prefetchStarted, prefetchStarted).n;
const stored = sql.prepare("SELECT count(*) AS n FROM detail_cache WHERE tmdb_json IS NOT NULL").get().n;
const skipped = targets.length - opened;
console.log(
  `상세 미리 열기: 대상 ${targets.length}편 중 ${opened}편을 열었고` +
    (skipped > 0 ? `(시간 예산 초과로 ${skipped}편은 다음으로)` : "") +
    `, 새로 받은 ${fetched}편, 실패 ${failed}편, ${((Date.now() - prefetchStarted) / 1000).toFixed(0)}초 (보관 중 ${stored}편)`,
);

// ─── 7. 저장 ② ───────────────────────────────────────────────────────────────

if (D1_CONFIG) {
  // 미리 받기는 부가 작업이다. 이 저장이 실패해도 수집 결과는 이미 반영돼 있으므로
  // 멈추지 않고 "일부 실패"로 기록한다.
  try {
    const statements = runSqlOnD1(prefetchedSql(sql, prefetchStarted));
    console.log(`운영 D1(${D1_TARGET})에 미리 받은 상세를 ${statements}개 문장으로 반영했습니다.`);
  } catch (error) {
    console.error("미리 받은 상세를 D1 에 반영하지 못했습니다.", error);
    incomplete.push("상세 미리 받기 저장");
  }
}

// 미리 받기 동안 제공처 등이 새로 저장됐으므로 마지막 상태를 기록한다.
const finalTables = dump(sql);
mkdirSync(join(ROOT, "data"), { recursive: true });
writeFileSync(
  CATALOG,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      counts: Object.fromEntries(Object.entries(finalTables).map(([table, rows]) => [table, rows.length])),
      tables: finalTables,
    },
    null,
    2,
  ) + "\n",
);
console.log("data/catalog.json 을 갱신했습니다.");

if (incomplete.length > 0) {
  console.error(`수집하지 못한 항목이 있습니다: ${incomplete.join(", ")}`);
  process.exit(2);
}
