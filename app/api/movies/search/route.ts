import { KobisApiError, searchKobisMovies } from "@/lib/kobis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20;

  if (!query) {
    return Response.json({ movies: [] });
  }

  try {
    const movies = await searchKobisMovies(query, limit);
    // 같은 검색어는 엣지에서 바로 준다. 인기 검색어일수록 KOBIS를 덜 부른다.
    // 개인화 요소가 없는 공개 응답이라 캐시해도 안전하다.
    return Response.json(
      { movies },
      {
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof KobisApiError ? error.message : "검색 중 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 502 });
  }
}
