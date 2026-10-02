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

test("sends the detail page's top button back to the release list it came from", async () => {
  const [back, more, detail] = await Promise.all([
    read("components/detail-back-link.tsx"),
    read("components/release-more-details.tsx"),
    read("app/movie/[movieCd]/page.tsx"),
  ]);
  assert.match(detail, /<DetailBackLink \/>/);
  // 카드를 누를 때 그 카드 주소도 적어, 상세가 자기가 그 목록에서 왔는지 확인한다.
  assert.match(more, /href: link\.getAttribute\("href"\)/);
  assert.match(more, /readSnapshot\(STORAGE_PREFIX \+ view\)\?\.href === pathname/);
  // 목록에서 왔으면 뒤로가기(목록이 펼침·위치를 되살림), 아니면 영화 찾기.
  assert.match(back, /개봉작 목록으로/);
  assert.match(back, /router\.back\(\)/);
  assert.match(back, /href="\/search"/);
});
