import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("restores the opened 더 보기 list and scroll position only when coming back", async () => {
  const [more, page] = await Promise.all([read("components/release-more-details.tsx"), read("components/release-catalog-page.tsx")]);
  // 최신·예정 목록을 따로 기억한다.
  assert.match(page, /<ReleaseMoreDetails\s+storageKey=\{view\}/);
  assert.doesNotMatch(page, /<details/);
  // 카드를 누르는 순간 펼침 여부와 위치를 적고, 뒤로가기일 때만 되살린다.
  assert.match(more, /sessionStorage\.setItem\(key, JSON\.stringify\(\{ open: ref\.current\.open, y: window\.scrollY \}\)\)/);
  assert.match(more, /addEventListener\("popstate"/);
  assert.match(more, /if \(!back \|\| !snapshot\) return;/);
  assert.match(more, /window\.scrollTo\(0, snapshot\.y\)/);
});
