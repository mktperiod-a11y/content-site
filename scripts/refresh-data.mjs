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

mkdirSync(join(ROOT, "data"), { recursive: true });
writeFileSync(
  CATALOG,
  JSON.stringify({ generatedAt: new Date().toISOString(), counts, tables }, null, 2) + "\n",
);
console.log(`data/catalog.json 을 갱신했습니다.`);

if (response.status >= 400) process.exit(1);
