import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { KdiskFlow } from "@/components/kdisk-flow";
import {
  KobisApiError,
  formatKobisOpenDate,
  formatKobisRuntime,
  getKobisMovieInfo,
  type KobisMovieDetail,
} from "@/lib/kobis";
import { PROVIDER_CATALOG, findLocalProviderMatch } from "@/lib/movies";

type PageParams = { movieCd: string };

const getMovieInfoCached = cache(async (movieCd: string) => {
  try {
    return { data: await getKobisMovieInfo(movieCd), error: null as string | null };
  } catch (error) {
    const message = error instanceof KobisApiError ? error.message : "작품 정보를 불러오지 못했어요.";
    return { data: null as KobisMovieDetail | null, error: message };
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { movieCd } = await params;
  const { data } = await getMovieInfoCached(movieCd);
  if (!data) {
    return { title: "작품 정보 | 어디서 보지?" };
  }

  const directorText = data.directors.length ? ` · ${data.directors.join(", ")} 감독` : "";
  return {
    title: `${data.titleKo} (${data.prdtYear}) 어디서 보지? | OTT 제공처 확인`,
    description: `${data.titleKo}${directorText}. 구독·대여·구매 등 국내 OTT 이용 방법을 확인하세요.`,
  };
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { movieCd } = await params;
  const { data: movie, error } = await getMovieInfoCached(movieCd);

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
          <p className="text-sm font-semibold text-destructive">작품 정보를 불러오지 못했어요</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{error}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            KOBIS(영화진흥위원회) 서비스 상태에 따라 일시적으로 조회가 안 될 수 있어요. 잠시 후
            다시 시도해주세요.
          </p>
          <Button asChild className="mt-8 rounded-xl">
            <Link href="/">
              <ArrowLeft className="size-4" />
              다시 검색하기
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  if (!movie) {
    notFound();
  }

  const openDate = formatKobisOpenDate(movie.openDt);
  const runtime = formatKobisRuntime(movie.runtimeMinutes);
  const genre = movie.genres.join("·");
  const localMatch = findLocalProviderMatch(movie.titleKo, movie.prdtYear);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.titleKo,
    ...(movie.titleEn ? { alternateName: movie.titleEn } : {}),
    ...(openDate ? { datePublished: openDate } : {}),
    ...(movie.directors.length
      ? { director: movie.directors.map((name) => ({ "@type": "Person", name })) }
      : {}),
    ...(movie.genres.length ? { genre: movie.genres } : {}),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      <section className="px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            href="/"
          >
            <ArrowLeft className="size-4" />
            다른 작품 검색하기
          </Link>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {movie.prdtYear && <span>{movie.prdtYear}</span>}
                {movie.typeNm && <span>· {movie.typeNm}</span>}
                {runtime && <span>· {runtime}</span>}
                {movie.watchGrade && <span>· {movie.watchGrade}</span>}
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                {movie.titleKo}
              </h1>
              {(movie.titleEn || movie.titleOriginal) && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {[movie.titleEn, movie.titleOriginal].filter(Boolean).join(" · ")}
                  {genre ? ` · ${genre}` : ""}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              기본 정보 출처: KOBIS(영화진흥위원회) {openDate && `· 개봉일 ${openDate}`}
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.28fr_0.72fr]">
            <article className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_22px_70px_rgba(25,35,55,0.08)]">
              <div className="border-b border-border px-6 py-5 sm:px-8">
                <p className="text-sm font-medium text-muted-foreground">작품 정보</p>
                <p className="mt-1 text-lg font-bold">KOBIS 기본정보</p>
              </div>
              <dl className="grid grid-cols-1 gap-5 px-6 py-6 sm:grid-cols-2 sm:px-8">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">감독</dt>
                  <dd className="mt-1 font-semibold">
                    {movie.directors.length ? movie.directors.join(", ") : "정보 없음"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">주요 출연진</dt>
                  <dd className="mt-1 font-semibold">
                    {movie.actors.length ? movie.actors.slice(0, 6).join(", ") : "정보 없음"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">제작 국가</dt>
                  <dd className="mt-1 font-semibold">
                    {movie.nations.length ? movie.nations.join(", ") : "정보 없음"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">장르</dt>
                  <dd className="mt-1 font-semibold">{genre || "정보 없음"}</dd>
                </div>
              </dl>
              <div className="flex items-start gap-2.5 bg-muted/65 px-6 py-4 text-sm leading-6 text-muted-foreground sm:px-8">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>
                  포스터·평점·줄거리·리뷰는 아직 연동 전이에요. TMDB 등 이미지·평점 데이터 연동
                  이후 제공될 예정입니다.
                </p>
              </div>
            </article>

            {localMatch && localMatch.providers.length > 0 ? (
              <article className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_22px_70px_rgba(25,35,55,0.08)]">
                <div className="border-b border-border px-6 py-5 sm:px-8">
                  <p className="text-sm font-medium text-muted-foreground">구독형 OTT 제공처</p>
                  <p className="mt-1 text-lg font-bold">
                    현재 {localMatch.providers.length}개 서비스에서 확인됐어요
                  </p>
                </div>
                <div className="divide-y divide-border px-6 sm:px-8">
                  {localMatch.providers.map((provider) => {
                    const catalogEntry = PROVIDER_CATALOG[provider.id];
                    if (!catalogEntry) return null;
                    return (
                      <div className="flex items-center justify-between gap-4 py-5" key={provider.id}>
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-xl bg-ink text-sm font-black text-brand">
                            {catalogEntry.name.slice(0, 1)}
                          </span>
                          <span className="font-bold">{catalogEntry.name}</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {provider.offers.map((offer) => (
                            <span
                              className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                              key={offer}
                            >
                              {offer}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-start gap-2.5 bg-muted/65 px-6 py-4 text-sm leading-6 text-muted-foreground sm:px-8">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <p>
                    제공처 정보는 기능 검토를 위한 예시 데이터예요. 이용 전 각 서비스에서 최종
                    확인해주세요.
                  </p>
                </div>
                <div className="px-6 pb-6 sm:px-8">
                  <Button asChild className="h-11 w-full rounded-xl" variant="outline">
                    <Link href={`/?tab=compare&add=${localMatch.id}`}>가격 비교에 담기</Link>
                  </Button>
                </div>
              </article>
            ) : (
              <div className="flex flex-col gap-5">
                <KdiskFlow title={movie.titleKo} />
                {localMatch && (
                  <Button asChild className="h-11 w-full rounded-xl" variant="outline">
                    <Link href={`/?tab=compare&add=${localMatch.id}`}>가격 비교에 담기</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
