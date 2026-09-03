import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tmdbSource = await readFile(new URL("../lib/tmdb.ts", import.meta.url), "utf8");
const enrichSource = await readFile(
  new URL("../app/api/movies/enrich/route.ts", import.meta.url),
  "utf8",
);
const comparisonSource = await readFile(
  new URL("../app/price-comparison.tsx", import.meta.url),
  "utf8",
);
const planSource = await readFile(new URL("../lib/ott-plans.ts", import.meta.url), "utf8");

test("keeps subscription, rental, and purchase provider types separate", () => {
  assert.match(tmdbSource, /subscription: mapProviders\(kr\.flatrate\)/);
  assert.match(tmdbSource, /rent: mapProviders\(kr\.rent\)/);
  assert.match(tmdbSource, /buy: mapProviders\(kr\.buy\)/);
  assert.match(enrichSource, /subscription: \(providers\?\.subscription \?\? \[\]\)/);
  assert.match(
    enrichSource,
    /rentOrBuyCount: \(providers\?\.rent\.length \?\? 0\) \+ \(providers\?\.buy\.length \?\? 0\)/,
  );
});

test("builds priced coverage from subscription providers only", () => {
  assert.match(comparisonSource, /for \(const provider of item\.subscription\)/);
  assert.match(comparisonSource, /coverage\.planIds\.includes\(plan\.id\)/);
  assert.doesNotMatch(comparisonSource, /findPlanByTmdbName\([^)]*rentOrBuyCount/);
});

test("excludes failed lookups and unknown prices from recommendations", () => {
  assert.match(comparisonSource, /state: "unknown"/);
  assert.match(comparisonSource, /coverage\.planIds\.length > 0/);
  assert.match(comparisonSource, /coverage\.planIds\.length === 0/);
});

test("labels the plan table as curated pricing rather than TMDB pricing", () => {
  assert.match(planSource, /TMDB는 어떤 서비스에서 볼 수 있는지는 알려주지만 "얼마인지"는/);
  assert.match(planSource, /별도로 관리해야 하는 큐레이션 데이터/);
});
