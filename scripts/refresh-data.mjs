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
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
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

/**
 * 운영 중인 Cloudflare D1 과 주고받는다.
 *
 * 무료 플랜의 워커는 요청 한 번에 외부 호출을 50번까지만 할 수 있어서,
 * 사이트 안에서 도는 수집은 포스터·매칭 단계에서 한도에 걸려 대부분
 * 실패했다. 무거운 수집은 제한이 없는 여기서 끝내고, 결과만 D1 에 채운다.
 *
 * D1_CONFIG 가 없으면(키 없이 돌리는 시험 등) 이 연동은 건너뛴다.
 */
const D1_CONFIG = process.env.D1_CONFIG;
const D1_NAME = process.env.D1_NAME || "moviesiso";
// 시험할 때는 local 로 두고 D1_PERSIST 에 로컬 상태 폴더를 준다.
const D1_TARGET = process.env.D1_TARGET === "local" ? "local" : "remote";

function wranglerD1(args) {
  const extra = D1_TARGET === "local" && process.env.D1_PERSIST ? ["--persist-to", process.env.D1_PERSIST] : [];
  return execFileSync(
    "npx",
    ["wrangler", "d1", "execute", D1_NAME, `--${D1_TARGET}`, "--config", D1_CONFIG, ...extra, ...args],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] },
  );
}

function readD1Table(table) {
  return readD1Rows(`SELECT * FROM ${table}`);
}

function readD1Rows(query) {
  const out = wranglerD1(["--json", "--command", query]);
  // wrangler 가 JSON 앞뒤에 안내 문구를 붙이는 경우가 있어 배열 부분만 떼어 읽는다.
  const start = out.indexOf("[");
  return JSON.parse(out.slice(start))[0]?.results ?? [];
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

function pushToD1(sql, tables, detailSince) {
  const lines = [];
  // 상세 보관함은 이번 실행에서 새로 받은 행만 보낸다(수 MB 를 매번 다시 쓰지 않도록).
  const detailRows = sql
    .prepare("SELECT * FROM detail_cache WHERE kobis_fetched_at >= ? OR tmdb_fetched_at >= ?")
    .all(detailSince, detailSince);
  lines.push(...insertRowsSql("detail_cache", detailRows, columnsOf(sql, "detail_cache")));
  for (const table of PERSISTED) {
    lines.push(...insertRowsSql(table, tables[table], columnsOf(sql, table)));
  }
  // 극장 상영작은 내려간 영화를 지워야 한다. 이번에 목록을 받아온 극장사만
  // 정리하고, 받아오지 못한 극장사(예: CGV)는 D1 에 있는 그대로 둔다.
  const byChain = new Map();
  for (const row of tables.theater_movies) {
    if (!byChain.has(row.theater_code)) byChain.set(row.theater_code, []);
    byChain.get(row.theater_code).push(row.theater_movie_id);
  }
  for (const [code, ids] of byChain) {
    lines.push(
      `DELETE FROM theater_movies WHERE theater_code = ${sqlLiteral(code)} AND theater_movie_id NOT IN (${ids.map(sqlLiteral).join(",")});`,
    );
  }
  // 이번 실행이 개봉작 목록을 새로 받았다면 사이트도 그 시각을 알게 한다.
  const releaseState = sql.prepare("SELECT * FROM sync_state WHERE sync_key = 'release_catalog'").all();
  if (releaseState.length && releaseState[0].last_success_at) {
    lines.push(
      `UPDATE sync_state SET last_success_at = MAX(COALESCE(last_success_at, 0), ${Number(releaseState[0].last_success_at)}), updated_at = ${Date.now()} WHERE sync_key = 'release_catalog';`,
    );
  }
  const file = join(tmpdir(), `moviesiso-d1-${Date.now()}.sql`);
  writeFileSync(file, lines.join("\n") + "\n");
  try {
    wranglerD1(["--file", file, "--yes"]);
  } finally {
    rmSync(file, { force: true });
  }
  return lines.length;
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

if (D1_CONFIG) {
  // 운영 D1 이 기준이다. 사이트에서 상세를 열 때 새로 저장된 정보까지 가져와
  // 이번 수집의 출발점으로 삼는다. 그래야 채워 넣을 때 그 정보를 덮어쓰지 않는다.
  let fromD1 = 0;
  for (const table of PERSISTED) {
    const rows = readD1Table(table);
    if (rows.length === 0) continue;
    const columns = columnsOf(sql, table).filter((c) => c in rows[0]);
    const insert = sql.prepare(
      `INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    );
    for (const row of rows) insert.run(...columns.map((c) => row[c] ?? null));
    fromD1 += rows.length;
  }
  console.log(`운영 D1(${D1_TARGET})에서 ${fromD1}행을 가져왔습니다.`);

  // 상세 보관함도 가져온다. KOBIS 작품 정보는 7일 동안 다시 받지 않아도 되므로
  // 이미 있는 것은 건너뛰게 된다. 표가 아직 없으면(배포 전) 조용히 넘어간다.
  try {
    const rows = readD1Table("detail_cache");
    if (rows.length) {
      const columns = columnsOf(sql, "detail_cache").filter((c) => c in rows[0]);
      const insert = sql.prepare(
        `INSERT OR REPLACE INTO detail_cache (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      );
      for (const row of rows) insert.run(...columns.map((c) => row[c] ?? null));
    }
    console.log(`상세 보관함 ${rows.length}건을 가져왔습니다.`);
  } catch {
    console.warn("운영 D1 에 상세 보관함이 아직 없습니다. 먼저 'Cloudflare 배포'로 표를 만들어주세요.");
  }

  // 개봉작 목록은 7일마다 새로 받는 설계다. 사이트가 최근에 받아뒀다면 그 시각을
  // 가져와 건너뛰게 한다. 그러지 않으면 매 실행마다 KOBIS 목록 수백 건을 새로
  // 받아, 하루에 여러 번 돌릴 때 KOBIS 응답이 느려져 실패했다.
  const releaseState = readD1Rows("SELECT * FROM sync_state WHERE sync_key = 'release_catalog'");
  if (releaseState.length) {
    const columns = columnsOf(sql, "sync_state").filter((c) => c in releaseState[0]);
    sql.prepare(
      `INSERT OR REPLACE INTO sync_state (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    ).run(...columns.map((c) => (c === "lock_until" ? 0 : c === "lock_token" ? null : releaseState[0][c] ?? null)));
    console.log(
      `개봉작 목록 마지막 수집: ${releaseState[0].last_success_at ? new Date(releaseState[0].last_success_at).toISOString() : "없음"}`,
    );
  }
}

/*
 * 사이트 안의 수집은 무료 플랜의 외부 호출 한도에 걸려 실패한 건을 '오류'로
 * 남긴다. 앱은 오류 건을 포스터 30일, 매칭 7일 동안 다시 시도하지 않는데,
 * 한도 탓에 난 오류라 기다릴 이유가 없다. 이 수집기 안에서만 대기 표시를
 * 풀어 이번 실행에서 바로 다시 시도한다. 앱의 재시도 규칙은 그대로 둔다.
 */
const retried = {
  // '찾을 수 없음'도 다시 본다. 제목 규칙이 나아지면 바로 잡히고, 대상은
  // 포스터가 없는 상영작뿐이라 하루 수십 건 수준이다.
  // 2026-09-30 부터 포스터는 제목과 연도가 함께 맞아야 붙는다. 그 전에 제목만으로
  // 붙은 포스터는 다른 작품의 것일 수 있어 한 번 모두 다시 검사한다.
  rechecked: sql.prepare(
    `UPDATE theater_movies SET poster_url = NULL, tmdb_status = 'pending'
     WHERE tmdb_status = 'matched' AND (tmdb_updated_at IS NULL OR tmdb_updated_at < ${Date.UTC(2026, 8, 30, 10, 0)})`,
  ).run().changes,
  posters: sql.prepare(
    "UPDATE theater_movies SET tmdb_status = 'pending' WHERE poster_url IS NULL AND tmdb_status IN ('error', 'not_found')",
  ).run().changes,
  kobis: sql.prepare(
    "UPDATE theater_movies SET kobis_status = 'pending' WHERE kobis_status = 'error'",
  ).run().changes,
  tmdbIds: sql.prepare(
    "UPDATE movies SET tmdb_updated_at = NULL WHERE tmdb_id IS NULL AND tmdb_status = 'id_error'",
  ).run().changes,
};
console.log("오류로 멈춰 있던 건을 다시 시도합니다:", retried);

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
      // 한두 건이 실패한 것은 일시적인 오류다. 키 문제는 시작 전 점검에서 이미
      // 걸러지므로, 여기서는 여러 건이 모두 실패한 경우만 멈춘다.
      if (value.checked >= 5 && value.errors === value.checked) {
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

/**
 * 1탭에 보이는 영화(지금 상영작 + 개봉 예정작)의 상세 화면을 미리 한 번씩 연다.
 * 상세 화면은 받은 KOBIS·TMDB 응답을 detail_cache 에 넣으므로, 여기서 연 만큼
 * 방문자는 외부를 기다리지 않고 바로 본다. 수집 로직을 따로 옮겨 적지 않는다.
 */
const PREFETCH_LIMIT = 300;
const PREFETCH_CONCURRENCY = 4;
const prefetchStarted = Date.now();
const ymd = (offsetDays) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(Date.now() + offsetDays * 86400000))
    .reduce((acc, part) => ((acc[part.type] = part.value), acc), {});
  return `${parts.year}${parts.month}${parts.day}`;
};
const targets = sql
  .prepare(
    `SELECT movie_cd FROM (
       SELECT m.movie_cd, m.open_date FROM movies AS m
       WHERE EXISTS (SELECT 1 FROM theater_movies AS tm WHERE tm.normalized_title = m.normalized_title)
       UNION
       SELECT movie_cd, open_date FROM movies WHERE open_date > ? AND open_date <= ?
     )
     ORDER BY open_date DESC
     LIMIT ?`,
  )
  .all(ymd(0), ymd(120), PREFETCH_LIMIT)
  .map((row) => row.movie_cd);

// 화면은 36시간까지 보관본을 쓰지만, 수집기는 하루 한 번 돌므로 20시간이 지난
// TMDB 응답은 다시 받게 한다. 그래야 OTT 제공처가 매일 새로워진다.
sql.prepare("UPDATE detail_cache SET tmdb_fetched_at = NULL WHERE tmdb_fetched_at < ?").run(
  Date.now() - 20 * 60 * 60 * 1000,
);

let prefetchFailed = 0;
for (let index = 0; index < targets.length; index += PREFETCH_CONCURRENCY) {
  await Promise.all(
    targets.slice(index, index + PREFETCH_CONCURRENCY).map(async (movieCd) => {
      try {
        const res = await worker.fetch(
          new Request(`http://localhost/movie/${encodeURIComponent(movieCd)}`),
          { ASSETS: { fetch: async () => new Response("not found", { status: 404 }) }, DB: db },
          { waitUntil() {}, passThroughOnException() {} },
        );
        await res.arrayBuffer();
        if (!res.ok) prefetchFailed += 1;
      } catch {
        prefetchFailed += 1;
      }
    }),
  );
}
const prefetched = sql
  .prepare(
    `SELECT count(*) AS n FROM detail_cache
     WHERE kobis_fetched_at >= ? OR tmdb_fetched_at >= ?`,
  )
  .get(prefetchStarted, prefetchStarted).n;
const readyTotal = sql.prepare("SELECT count(*) AS n FROM detail_cache WHERE tmdb_json IS NOT NULL").get().n;
console.log(
  `상세 미리 열기: 대상 ${targets.length}편, 이번에 새로 받은 ${prefetched}편, 실패 ${prefetchFailed}편 (보관 중 ${readyTotal}편)`,
);

if (D1_CONFIG) {
  // 상세를 여는 동안 제공처 등이 새로 저장됐으므로 표를 다시 떠서 보낸다.
  const statements = pushToD1(sql, dump(sql), prefetchStarted);
  console.log(`운영 D1(${D1_TARGET})에 ${statements}개 문장으로 반영했습니다.`);
}

if (missing.length > 0) {
  // 받아온 만큼은 남겨야 하므로 저장을 마친 뒤에 알린다.
  // 종료 코드 2는 워크플로가 "일부 실패"로 구분해 읽는다.
  console.error(`수집하지 못한 항목이 있습니다: ${missing.join(", ")}`);
  process.exit(2);
}
