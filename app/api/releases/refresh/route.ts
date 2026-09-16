import { syncReleaseCatalog } from "@/lib/release-catalog";
import {
  syncTheaterCatalog,
  syncTheaterKobisMatches,
  syncTheaterMovieTmdbIds,
  syncTheaterPosters,
} from "@/lib/theater-catalog";

/**
 * 이 엔드포인트는 목록이 낡았을 때 화면이 스스로 부르는 자리다(components/release-refresh.tsx).
 * 수집량 자체는 sync_state 잠금이 막아주지만, 다른 사이트에 심어둔 스크립트가
 * 방문자 브라우저로 이곳을 두드리게 만들 이유는 없다. 브라우저가 붙여주는
 * Sec-Fetch-Site가 명시적으로 교차 출처일 때만 거절한다 —
 * 헤더를 보내지 않는 클라이언트(구형 브라우저 등)는 지금처럼 그대로 통과한다.
 */
function isCrossSite(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  return Boolean(site) && site !== "same-origin" && site !== "none";
}

export async function POST(request: Request) {
  if (isCrossSite(request)) {
    return Response.json({ error: "허용되지 않은 요청이에요." }, { status: 403 });
  }

  const [releaseResult, theaterResult] = await Promise.allSettled([
    syncReleaseCatalog(),
    syncTheaterCatalog(),
  ]);

  if (releaseResult.status === "rejected") {
    console.error("Release catalog refresh failed", releaseResult.reason);
  }
  if (theaterResult.status === "rejected") {
    console.error("Theater catalog refresh failed", theaterResult.reason);
  }

  if (releaseResult.status === "rejected" && theaterResult.status === "rejected") {
    return Response.json(
      { error: "영화 정보를 갱신하지 못했어요. 저장된 기존 목록은 유지됩니다." },
      { status: 502 },
    );
  }

  // 아래 세 가지는 모두 갓 저장된 극장 목록을 읽으므로 극장 수집 뒤에 돈다.
  async function run<T>(label: string, task: () => Promise<T>) {
    try {
      return await task();
    } catch (error) {
      console.error(`${label} failed`, error);
      return null;
    }
  }

  // 포스터 보강과 KOBIS 매칭은 서로 독립이라 함께 보낸다.
  // TMDB id 채우기만 KOBIS 매칭이 방금 넣은 작품까지 보도록 그 뒤에 잇는다.
  const [posterResult, [kobisResult, tmdbIdResult]] = await Promise.all([
    run("Theater poster refresh", syncTheaterPosters),
    run("Theater KOBIS match refresh", syncTheaterKobisMatches).then(
      async (kobis) =>
        [kobis, await run("Theater TMDB id refresh", syncTheaterMovieTmdbIds)] as const,
    ),
  ]);

  return Response.json({
    releases: releaseResult.status === "fulfilled" ? releaseResult.value : null,
    theaters: theaterResult.status === "fulfilled" ? theaterResult.value : null,
    posters: posterResult,
    kobisMatches: kobisResult,
    tmdbIds: tmdbIdResult,
    partial:
      releaseResult.status === "rejected" ||
      theaterResult.status === "rejected" ||
      posterResult === null ||
      kobisResult === null ||
      tmdbIdResult === null,
  });
}
