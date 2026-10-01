import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const expandable = await read("components/expandable-text.tsx");
const detail = await read("app/movie/[movieCd]/page.tsx");

test("folds a long synopsis behind 더보기 on mobile only", () => {
  assert.match(detail, /<ExpandableText className="mt-2 break-keep text-sm leading-7" text=\{tmdb\.movie\.overview\} \/>/);
  // 모바일에서만 넉 줄로 줄이고, 넓은 화면에서는 다 보여주며 버튼도 숨긴다.
  assert.match(expandable, /line-clamp-4 sm:line-clamp-none/);
  assert.match(expandable, /sm:hidden/);
  assert.match(expandable, /aria-expanded=\{expanded\}/);
  assert.match(expandable, /"접기" : "더보기"/);
});
