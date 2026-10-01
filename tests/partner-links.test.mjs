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
