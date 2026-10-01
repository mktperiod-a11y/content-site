import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const links = await read("lib/partner-links.ts");
const ondiskRoute = await read("app/go/ondisk/route.ts");
const kdiskRoute = await read("app/go/kdisk/route.ts");
const robots = await read("app/robots.txt/route.ts");

test("keeps the partner links in one place", () => {
  assert.match(links, /ondisk: "https:\/\/ondisk\.co\.kr\/mbridge\.php\?iw=md&inpid=mseesaw&j=2"/);
  assert.match(links, /kdisk: "https:\/\/kdisk\.co\.kr\/mbridge\.php\?iw=md&inpid=mseesaw&j=2"/);
  assert.match(links, /return `\/go\/\$\{partner\}`/);
});

test("redirects /go/* to the partner without caching or indexing", () => {
  assert.match(links, /status: 302/);
  assert.match(links, /location: PARTNER_LINKS\[partner\]/);
  assert.match(links, /"cache-control": "no-store"/);
  assert.match(links, /"x-robots-tag": "noindex, nofollow"/);
  assert.match(ondiskRoute, /redirectToPartner\("ondisk"\)/);
  assert.match(kdiskRoute, /redirectToPartner\("kdisk"\)/);
  assert.match(robots, /"Disallow: \/go\/"/);
});

test("sends every KDisk and OnDisk link through /go/*", async () => {
  // 파트너 주소를 코드에 직접 쓰면 파트너 코드 없이 나가거나 /go 로 가려지지 않는다.
  // 파트너 주소는 lib/partner-links.ts 한 곳에만 둔다.
  const { readdir } = await import("node:fs/promises");
  const offenders = [];
  for (const dir of ["app", "components", "lib"]) {
    for (const entry of await readdir(new URL(`../${dir}`, import.meta.url), { recursive: true })) {
      if (!/\.(tsx?|mjs)$/.test(entry) || `${dir}/${entry}` === "lib/partner-links.ts") continue;
      const source = await read(`${dir}/${entry}`);
      if (/https?:\/\/[^"'`\s]*(kdisk|ondisk)\.co\.kr/i.test(source)) offenders.push(`${dir}/${entry}`);
    }
  }
  assert.deepEqual(offenders, []);
});
