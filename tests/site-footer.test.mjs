import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps the required TMDB notice once, in the site-wide footer", async () => {
  const [layout, footer, attribution, detail] = await Promise.all([
    read("app/layout.tsx"),
    read("components/site-footer.tsx"),
    read("components/tmdb-attribution.tsx"),
    read("app/movie/[movieCd]/page.tsx"),
  ]);
  // TMDB 약관상 필수 문구다. 화면 칸에서는 빼도 사이트 어딘가엔 남아 있어야 한다.
  assert.match(attribution, /This product uses the TMDB API but is not endorsed or certified by TMDB\./);
  assert.match(footer, /<TmdbNotice \/>/);
  assert.match(layout, /<SiteFooter \/>/);
  assert.match(detail, /<JustWatchCredit link=\{tmdb\.providers\.link\} \/>/);
});
