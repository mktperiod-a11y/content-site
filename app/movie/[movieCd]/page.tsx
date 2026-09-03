import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { KdiskFlow } from "@/components/kdisk-flow";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import {
  KobisApiError,
  formatKobisOpenDate,
  formatKobisRuntime,
  getKobisMovieInfo,
  type KobisMovieDetail,
} from "@/lib/kobis";
import {
  LOW_VOTE_COUNT_THRESHOLD,
  findTmdbMatch,
  getTmdbMovie,
  getTmdbReviews,
  getTmdbWatchProvidersKR,
  type TmdbMovie,
  type TmdbReview,
  type WatchProvider,
  type WatchProvidersKR,
} from "@/lib/tmdb";

type PageParams = { movieCd: string };

const getMovieInfoCached = cache(async (movieCd: string) => {
  try {
    return { data: await getKobisMovieInfo(movieCd), error: null as string | null };
  } catch (error) {
    const message = error instanceof KobisApiError ? error.message : "작품 정보를 불러오지 못했어요.";
    return { data: null as KobisMovieDetail | null, error: message };
  }
});

type TmdbBundle = {
  movie: TmdbMovie | null;
  providers: WatchProvidersKR | null;
  reviews: TmdbReview[];
  /** TMDB 조회 자체가 실패했는지 (매칭 실패와 구분) */
  failed: boolean;
};

/**
 * KOBIS 작품을 TMDB에 매칭해 이미지·평점·줄거리·리뷰·제공처를 가져온다.
 * TMDB 쪽이 실패해도 KOBIS 기본정보는 그대로 보여줘야 하므로 예외를 삼킨다.
 */
const getTmdbBundleCached = cache(
  async (titleKo: string, year: string, titleEn: string): Promise<TmdbBundle> => {
    const empty: TmdbBundle = { movie: null, providers: null, reviews: [], failed: false };
    try {
      const match = await findTmdbMatch(titleKo, year, titleEn);
      if (!match) return empty;

      const [movie, providers, reviews] = await Promise.all([
        getTmdbMovie(match.id),
        getTmdbWatchProvidersKR(match.id),
        getTmdbReviews(match.id),
      ]);
      return { movie, providers, reviews, failed: false };
    } catch {
      return { ...empty, failed: true };
    }
  },
);

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

function ProviderRow({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (!providers.length) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <span className="mt-1.5 shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
        {label}
      </span>
      <div className="flex flex-wrap justify-end gap-2">
        {providers.map((provider) => (
          <span
            className="flex items-center gap-2 rounded-xl border border-border px-2.5 py-1.5"
            key={provider.providerId}
          >
            {provider.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- TMDB CDN 원격 이미지. 이 배포 환경의 이미지 최적화는 로컬 asset만 지원합니다.
              <img alt="" className="size-5 rounded" src={provider.logoUrl} />
            )}
            <span className="text-sm font-semibold">{provider.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
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

  const tmdb = await getTmdbBundleCached(movie.titleKo, movie.prdtYear, movie.titleEn);
  const subscriptionProviders = tmdb.providers?.subscription ?? [];
  const hasAnyProvider =
    subscriptionProviders.length > 0 ||
    (tmdb.providers?.rent.length ?? 0) > 0 ||
    (tmdb.providers?.buy.length ?? 0) > 0;
  // 제공처 정보를 실제로 확인한 경우에만 "확인되지 않음"을 말할 수 있다.
  const providerLookupSucceeded = !tmdb.failed && tmdb.movie !== null;
  const showRating = tmdb.movie && tmdb.movie.voteCount > 0;
  const lowConfidenceRating = tmdb.movie ? tmdb.movie.voteCount < LOW_VOTE_COUNT_THRESHOLD : false;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.titleKo,
    ...(movie.titleEn ? { alternateName: movie.titleEn } : {}),
    ...(openDate ? { datePublished: openDate } : {}),
    ...(tmdb.movie?.posterUrl ? { image: tmdb.movie.posterUrl } : {}),
    ...(tmdb.movie?.overview ? { description: tmdb.movie.overview } : {}),
    ...(movie.directors.length
      ? { director: movie.directors.map((name) => ({ "@type": "Person", name })) }
      : {}),
    ...(movie.actors.length
      ? { actor: movie.actors.slice(0, 6).map((name) => ({ "@type": "Person", name })) }
      : {}),
    ...(movie.genres.length ? { genre: movie.genres } : {}),
    ...(showRating && !lowConfidenceRating && tmdb.movie
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: tmdb.movie.voteAverage,
            ratingCount: tmdb.movie.voteCount,
            bestRating: 10,
          },
        }
      : {}),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      <section className="relative overflow-hidden bg-ink text-white">
        {tmdb.movie?.backdropUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- TMDB CDN 원격 이미지. 이 배포 환경의 이미지 최적화는 로컬 asset만 지원합니다. */}
            <img
              alt=""
              aria-hidden="true"
              className="absolute inset-0 size-full object-cover opacity-25"
              src={tmdb.movie.backdropUrl}
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/55"
              aria-hidden="true"
            />
          </>
        )}

        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-[15px] font-bold text-white shadow-lg shadow-black/15 backdrop-blur transition-colors hover:border-brand/70 hover:bg-white/15 hover:text-brand"
            href="/"
          >
            <ArrowLeft className="size-4.5" strokeWidth={2.5} />
            다른 작품 검색하기
          </Link>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="w-32 shrink-0 overflow-hidden rounded-2xl bg-white/10 shadow-2xl sm:w-44">
              {tmdb.movie?.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- TMDB CDN 원격 이미지. 이 배포 환경의 이미지 최적화는 로컬 asset만 지원합니다.
                <img
                  alt={`${movie.titleKo} 포스터`}
                  className="block w-full"
                  src={tmdb.movie.posterUrl}
                />
              ) : (
                <div className="grid aspect-[2/3] place-items-center px-3 text-center text-xs leading-5 text-white/40">
                  포스터 정보 없음
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/55">
                {movie.prdtYear && <span>{movie.prdtYear}</span>}
                {movie.typeNm && <span>· {movie.typeNm}</span>}
                {runtime && <span>· {runtime}</span>}
                {movie.watchGrade && <span>· {movie.watchGrade}</span>}
              </div>
              <h1 className="mt-3 text-balance break-keep text-3xl font-black leading-[1.2] tracking-[-0.035em] sm:text-5xl">
                {movie.titleKo}
              </h1>
              {(movie.titleEn || movie.titleOriginal) && (
                <p className="mt-2 text-sm text-white/50">
                  {[movie.titleEn, movie.titleOriginal].filter(Boolean).join(" · ")}
                  {genre ? ` · ${genre}` : ""}
                </p>
              )}

              {showRating && tmdb.movie && (
                <div className="mt-5 flex items-center gap-2.5">
                  <Star
                    className={
                      lowConfidenceRating ? "size-4 text-white/40" : "size-5 text-brand"
                    }
                    fill="currentColor"
                  />
                  <span
                    className={
                      lowConfidenceRating
                        ? "text-sm text-white/55"
                        : "text-xl font-black text-brand"
                    }
                  >
                    {tmdb.movie.voteAverage.toFixed(1)}
                  </span>
                  <span className="text-xs text-white/40">
                    TMDB · 평가 {tmdb.movie.voteCount.toLocaleString("ko-KR")}명
                    {lowConfidenceRating && " (표본이 적어 참고용)"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 lg:grid-cols-[1.28fr_0.72fr]">
            <div className="flex flex-col gap-5">
              <article className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_22px_70px_rgba(25,35,55,0.08)]">
                <div className="border-b border-border px-6 py-5 sm:px-8">
                  <p className="text-sm font-medium text-muted-foreground">작품 정보</p>
                  <p className="mt-1 text-lg font-bold">기본정보</p>
                </div>

                {tmdb.movie?.overview && (
                  <div className="border-b border-border px-6 py-5 sm:px-8">
                    <p className="text-xs font-semibold text-muted-foreground">줄거리</p>
                    <p className="mt-2 break-keep text-sm leading-7">{tmdb.movie.overview}</p>
                  </div>
                )}

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
                    기본정보 출처: KOBIS(영화진흥위원회)
                    {openDate && ` · 개봉일 ${openDate}`}
                    {tmdb.movie && " · 이미지·평점·줄거리: TMDB"}
                  </p>
                </div>
              </article>

              <article className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_22px_70px_rgba(25,35,55,0.08)]">
                <div className="border-b border-border px-6 py-5 sm:px-8">
                  <p className="text-sm font-medium text-muted-foreground">관람평</p>
                  <p className="mt-1 text-lg font-bold">
                    {tmdb.reviews.length ? "TMDB 사용자 리뷰" : "등록된 리뷰 없음"}
                  </p>
                </div>
                {tmdb.reviews.length ? (
                  <div className="divide-y divide-border">
                    {tmdb.reviews.slice(0, 3).map((review) => (
                      <div className="px-6 py-5 sm:px-8" key={review.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold">{review.author}</p>
                          {review.rating !== null && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                              <Star className="size-3.5" fill="currentColor" />
                              {review.rating}/10
                            </span>
                          )}
                        </div>
                        <p className="mt-2 break-keep text-sm leading-7 text-muted-foreground">
                          {review.content.length > 220
                            ? `${review.content.slice(0, 220).trimEnd()}…`
                            : review.content}
                        </p>
                        {review.url && (
                          <a
                            className="mt-2 inline-block text-xs font-semibold underline decoration-border underline-offset-4"
                            href={review.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            TMDB에서 전체 리뷰 보기
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-6 py-8 text-sm leading-6 text-muted-foreground sm:px-8">
                    아직 등록된 사용자 리뷰가 없어요.
                  </p>
                )}
              </article>
            </div>

            <div className="flex flex-col gap-5">
              {hasAnyProvider && tmdb.providers ? (
                <article className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_22px_70px_rgba(25,35,55,0.08)]">
                  <div className="border-b border-border px-6 py-5 sm:px-8">
                    <p className="text-sm font-medium text-muted-foreground">국내 제공처</p>
                    <p className="mt-1 text-lg font-bold">
                      {subscriptionProviders.length > 0
                        ? `구독형 ${subscriptionProviders.length}곳에서 확인됐어요`
                        : "대여·구매로 볼 수 있어요"}
                    </p>
                  </div>
                  <div className="divide-y divide-border px-6 sm:px-8">
                    <ProviderRow label="구독" providers={subscriptionProviders} />
                    <ProviderRow label="대여" providers={tmdb.providers.rent} />
                    <ProviderRow label="구매" providers={tmdb.providers.buy} />
                  </div>
                  <div className="flex items-start gap-2.5 bg-muted/65 px-6 py-4 sm:px-8">
                    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="space-y-2">
                      <p className="text-sm leading-6 text-muted-foreground">
                        제공 정보는 변경될 수 있어요. 이용 전 각 서비스에서 최종 확인해주세요.
                      </p>
                      <TmdbAttribution justWatchLink={tmdb.providers.link} />
                    </div>
                  </div>
                </article>
              ) : providerLookupSucceeded ? (
                <>
                  <KdiskFlow title={movie.titleKo} />
                  <div className="rounded-[1.6rem] border border-border bg-card px-6 py-5">
                    <TmdbAttribution justWatchLink={tmdb.providers?.link} />
                  </div>
                </>
              ) : (
                <article className="rounded-[1.6rem] border border-border bg-card px-6 py-8 sm:px-8">
                  <p className="text-lg font-bold">제공처 정보를 확인하지 못했어요.</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    이 작품의 국내 제공처 데이터를 가져오지 못했습니다. 잠시 후 다시
                    확인해주세요.
                  </p>
                </article>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
