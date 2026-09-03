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
    return Response.json({ movies });
  } catch (error) {
    const message =
      error instanceof KobisApiError ? error.message : "검색 중 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 502 });
  }
}
