import Link from "next/link";
import { CalendarDays, Clapperboard, Star } from "lucide-react";

import { ReleaseRefresh } from "@/components/release-refresh";
import { SiteHeader } from "@/components/site-header";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import {
  getReleaseCatalog,
  type ReleaseMovie,
  type ReleaseView,
} from "@/lib/release-catalog";

function formatOpenDate(value: string) {
  if (!/^\d{8}$/.test(value)) return "개봉일 미정";
  return `${Number(value.slice(4, 6))}월 ${Number(value.slice(6, 8))}일`;
}

function formatUpdatedAt(value: number | null) {
  if (!value) return "첫 수집 전";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function ReleaseMovieCard({ movie, view }: { movie: ReleaseMovie; view: ReleaseView }) {
  const subscription = movie.providers.filter((provider) => provider.type === "subscription");
  const extraCount = Math.max(subscription.length - 3, 0);
  const cardClassName =
    "group flex min-h-full flex-col overflow-hidden rounded-2xl bg-card shadow-[0_16px_40px_rgba(20,32,51,0.08)] ring-1 ring-border/80 transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_52px_rgba(20,32,51,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-muted";
  const cardContent = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden bg-secondary">
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- TMDB CDN remote image.
          <img
            alt={`${movie.titleKo} 포스터`}
            className="size-full object-cover transition duration-300 group-hover:scale-[1.025]"
            loading="lazy"
            src={movie.posterUrl}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-5 text-center text-sm font-medium text-muted-foreground">
            <Clapperboard className="size-8 opacity-40" />
            <span>포스터 준비 중</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-ink/88 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
          {formatOpenDate(movie.openDate)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="line-clamp-2 break-keep text-lg font-black leading-snug tracking-[-0.02em] text-foreground">
            {movie.titleKo}
          </h2>
          {movie.voteAverage !== null && movie.voteCount > 0 && (
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-black text-foreground">
              <Star className="size-3.5 text-brand" fill="currentColor" />
              {movie.voteAverage.toFixed(1)}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
          {[movie.directors[0], movie.genres[0], movie.nations[0]].filter(Boolean).join(" · ") ||
            movie.productionYear}
        </p>

        <div className="mt-auto flex min-h-9 flex-wrap items-end gap-1.5 pt-4">
          {subscription.length ? (
            <>
              {subscription.slice(0, 3).map((provider) => (
                <span
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-xs font-bold text-secondary-foreground"
                  key={provider.providerId}
                >
                  {provider.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- TMDB provider logo.
                    <img alt="" className="size-4 rounded" src={provider.logoUrl} />
                  )}
                  {provider.name}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="inline-flex h-8 items-center rounded-full bg-secondary px-2.5 text-xs font-bold text-muted-foreground">
                  +{extraCount}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              {view === "upcoming"
                ? "개봉 후 제공처가 확인돼요"
                : movie.movieCd
                  ? "구독형 제공처는 상세에서 확인"
                  : "작품 정보를 준비하고 있어요"}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return movie.movieCd ? (
    <Link
      className={cardClassName}
      href={`/movie/${movie.movieCd}`}
    >
      {cardContent}
    </Link>
  ) : (
    <article className={cardClassName}>{cardContent}</article>
  );
}

export async function ReleaseCatalogPage({ view }: { view: ReleaseView }) {
  const isUpcoming = view === "upcoming";
  const [nowCatalog, upcomingCatalog] = await Promise.all([
    getReleaseCatalog("now"),
    getReleaseCatalog("upcoming"),
  ]);
  const catalog = isUpcoming ? upcomingCatalog : nowCatalog;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader
        navigation={
          <nav aria-label="주요 기능" className="flex h-14 items-center gap-1.5">
            <Link
              aria-current="page"
              className="relative inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/[0.09] px-4 text-[15px] font-bold text-brand after:absolute after:inset-x-0 after:bottom-[-8px] after:h-0.5 after:bg-brand"
              href={isUpcoming ? "/movies/upcoming" : "/movies/now"}
            >
              <CalendarDays className="size-4" />
              개봉작
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-xl px-4 text-[15px] font-bold text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
              href="/search?tab=compare"
            >
              가격 비교하기
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-xl px-4 text-[15px] font-bold text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
              href="/search"
            >
              영화 찾기
            </Link>
          </nav>
        }
      />

      <section className="overflow-hidden bg-ink text-white">
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="glow glow-one" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start lg:gap-14">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-brand">
                <CalendarDays className="size-4" />
                개봉 정보는 주 1회 · 상영 여부는 하루 1회 갱신
              </span>
              <h1 className="mt-4 text-[2rem] font-black leading-[1.16] tracking-[1px] text-on-dark-primary sm:break-keep sm:text-6xl sm:leading-[1.12]">
                최신 개봉작과 예정작을
                <br className="hidden sm:block" /> 한곳에서 살펴보세요
              </h1>
              <p className="mt-5 max-w-2xl break-keep text-base leading-7 text-on-dark-secondary sm:text-lg">
                개봉일과 포스터를 확인하고, 관심 있는 작품의 국내 OTT 제공처를 살펴보세요.
              </p>

              <nav
                aria-label="개봉작 목록 전환"
                className="mt-8 inline-flex rounded-full border border-white/15 bg-surface-dark-soft p-1.5"
              >
                <Link
                  aria-current={!isUpcoming ? "page" : undefined}
                  className={`min-h-11 rounded-full px-5 py-3 text-sm font-black transition-colors ${
                    !isUpcoming
                      ? "bg-brand text-ink shadow-lg shadow-brand/10"
                      : "text-on-dark-secondary hover:bg-white/10 hover:text-white"
                  }`}
                  href="/movies/now"
                >
                  최신 개봉작
                </Link>
                <Link
                  aria-current={isUpcoming ? "page" : undefined}
                  className={`min-h-11 rounded-full px-5 py-3 text-sm font-black transition-colors ${
                    isUpcoming
                      ? "bg-brand text-ink shadow-lg shadow-brand/10"
                      : "text-on-dark-secondary hover:bg-white/10 hover:text-white"
                  }`}
                  href="/movies/upcoming"
                >
                  개봉 예정작
                </Link>
              </nav>
            </div>

            <aside className="w-full max-w-48 rounded-2xl bg-surface-dark-subtle p-4 lg:mt-10 lg:justify-self-end">
              <p className="text-xs font-semibold text-on-dark-tertiary">수집된 개봉 정보</p>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-on-dark-secondary">최신</dt>
                  <dd className="font-black text-brand">{nowCatalog.movies.length}편</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-on-dark-secondary">예정</dt>
                  <dd className="font-black text-brand">{upcomingCatalog.movies.length}편</dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-muted-foreground">
              {isUpcoming ? "곧 만날 작품" : "국내 극장 3사 현재상영작 기준"}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.02em] sm:text-3xl">
              {isUpcoming ? "개봉을 앞둔 영화" : "지금 극장에서 만날 영화"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              마지막 갱신 {formatUpdatedAt(catalog.lastSuccessAt)}
            </span>
            {catalog.movies.length > 0 && (
              <ReleaseRefresh shouldRefresh={catalog.stale} />
            )}
          </div>
        </div>

        {catalog.movies.length ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {catalog.movies.map((movie) => (
              <ReleaseMovieCard
                key={`${movie.movieCd ?? movie.titleKo}-${movie.openDate}`}
                movie={movie}
                view={view}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 text-center">
            <Clapperboard className="size-9 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-black">
              {catalog.unavailable ? "영화 목록을 불러오지 못했어요" : "개봉 정보를 준비하고 있어요"}
            </h2>
            <p className="mt-2 max-w-md break-keep text-sm leading-6 text-muted-foreground">
              {catalog.unavailable
                ? "잠시 후 다시 시도해주세요. 이전에 저장된 목록이 있으면 그대로 유지됩니다."
                : "첫 수집이 끝나면 이 화면에 영화 카드가 자동으로 표시됩니다."}
            </p>
            <div className="mt-5">
              <ReleaseRefresh shouldRefresh />
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>기본 개봉 정보: KOBIS(영화진흥위원회)</span>
          <TmdbAttribution />
        </div>
      </section>
    </main>
  );
}
