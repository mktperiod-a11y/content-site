import assert from "node:assert/strict";
import test from "node:test";

/**
 * 워커가 HTML을 서버에서 그려 내보내는지 확인하는 스모크 테스트.
 *
 * Sites 미리보기용 <meta name="codex-preview">가 붙어 나가는지 함께 본다.
 * 배포처가 Sites인 동안에는 이 표식이 유지돼야 한다.
 */
test("server-renders the page shell as HTML", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    // "/"는 /movies/now 로 리다이렉트하므로 HTML 본문이 있는 경로로 확인한다.
    new Request("http://localhost/search", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*\blang=["']ko["']/i);
  // 헤더가 실제로 그려졌는지 — 클라이언트 자바스크립트 없이도 보여야 한다.
  assert.match(html, /어디서 보지\?/);
  assert.match(html, /<title[^>]*>[^<]*어디서 보지\?/);
  // Sites 미리보기 표식.
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i,
  );
});
