import { KobisApiError, getKobisMovieInfo } from "@/lib/kobis";
import type { KobisMovieSummary } from "@/lib/kobis";

/**
 * movieCd로 작품 하나를 조회한다.
 * 상세 페이지에서 "가격 비교에 담기"로 넘어올 때, 가격 비교 탭이 그 작품의
 * 제목·연도를 알아야 제공처를 조회할 수 있어서 필요하다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const movieCd = searchParams.get("movieCd")?.trim() ?? "";

  if (!movieCd) {
    return Response.json({ error: "movieCd가 필요해요." }, { status: 400 });
  }

  try {
    const info = await getKobisMovieInfo(movieCd);
    if (!info) {
      return Response.json({ error: "작품을 찾을 수 없어요." }, { status: 404 });
    }

    const movie: KobisMovieSummary = {
      movieCd: info.movieCd,
      titleKo: info.titleKo,
      titleEn: info.titleEn,
      prdtYear: info.prdtYear,
      openDt: info.openDt,
      genreAlt: info.genres.join(","),
      nationAlt: info.nations.join(","),
      directors: info.directors,
    };
    return Response.json({ movie });
  } catch (error) {
    const message =
      error instanceof KobisApiError ? error.message : "작품 정보를 불러오지 못했어요.";
    return Response.json({ error: message }, { status: 502 });
  }
}
