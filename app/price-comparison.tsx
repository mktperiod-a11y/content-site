"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Crown,
  Loader2,
  Plus,
  Search,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { KdiskFlow } from "@/components/kdisk-flow";
import { OTT_PLANS, PRICES_VERIFIED_ON, findPlanByTmdbName, formatWon, type OttPlan } from "@/lib/ott-plans";
import type { KobisMovieSummary } from "@/lib/kobis";
import type { EnrichedMovie } from "@/lib/enrichment";

const MAX_SELECTED = 5;

type SearchStatus = "idle" | "loading" | "success" | "error";

/** 선택한 작품의 제공처 조회 상태 */
type MovieCoverage =
  | { state: "loading" }
  | { state: "unknown" } // 조회 실패/매칭 실패 — 아무것도 단정하지 않는다
  | { state: "none"; rentOrBuyCount: number } // 확인했지만 구독형에 없음
  | { state: "available"; planIds: string[]; unpricedProviders: string[] };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "요청에 실패했어요.");
  return body;
}

export function PriceComparison({
  initialAddId,
  onInitialAddHandled,
}: {
  initialAddId?: string;
  onInitialAddHandled?: () => void;
} = {}) {
  const [selected, setSelected] = useState<KobisMovieSummary[]>([]);
  const [enriched, setEnriched] = useState<Record<string, EnrichedMovie>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<KobisMovieSummary[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");

  const handledAddId = useRef<string | null>(null);
  const onInitialAddHandledRef = useRef(onInitialAddHandled);
  useEffect(() => {
    onInitialAddHandledRef.current = onInitialAddHandled;
  });

  // --- 상세 페이지에서 "가격 비교에 담기"로 넘어온 작품 담기 ---
  useEffect(() => {
    if (!initialAddId || handledAddId.current === initialAddId) return;
    handledAddId.current = initialAddId;

    let cancelled = false;
    void (async () => {
      try {
        const body = await fetchJson<{ movie: KobisMovieSummary }>(
          `/api/movies/lookup?movieCd=${encodeURIComponent(initialAddId)}`,
        );
        if (cancelled) return;
        setSelected((current) =>
          current.length >= MAX_SELECTED ||
          current.some((movie) => movie.movieCd === body.movie.movieCd)
            ? current
            : [...current, body.movie],
        );
      } catch {
        // 담기 실패 시 조용히 넘어간다 — 사용자가 직접 검색해서 담을 수 있다.
      } finally {
        if (!cancelled) onInitialAddHandledRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialAddId]);

  // --- 검색 (KOBIS) ---
  useEffect(() => {
    const trimmed = searchTerm.trim();

    const timer = setTimeout(async () => {
      if (!trimmed) {
        setSearchResults([]);
        setSearchStatus("idle");
        return;
      }

      setSearchStatus("loading");
      try {
        const body = await fetchJson<{ movies: KobisMovieSummary[] }>(
          `/api/movies/search?q=${encodeURIComponent(trimmed)}&limit=8`,
        );
        setSearchResults(body.movies ?? []);
        setSearchStatus("success");
      } catch {
        setSearchResults([]);
        setSearchStatus("error");
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- 선택한 작품의 제공처 조회 ---
  useEffect(() => {
    const missing = selected.filter((movie) => !enriched[movie.movieCd]);
    if (!missing.length) return;

    let cancelled = false;
    void (async () => {
      try {
        const body = await fetchJson<{ movies: EnrichedMovie[] }>("/api/movies/enrich", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: missing.map((movie) => ({
              movieCd: movie.movieCd,
              titleKo: movie.titleKo,
              titleEn: movie.titleEn,
              year: movie.prdtYear,
            })),
          }),
        });
        if (cancelled) return;
        setEnriched((current) => {
          const next = { ...current };
          for (const item of body.movies ?? []) next[item.movieCd] = item;
          return next;
        });
      } catch {
        // 실패하면 해당 작품은 "확인 불가"로 남는다.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected, enriched]);

  const coverageByMovie = useMemo(() => {
    const map = new Map<string, MovieCoverage>();
    for (const movie of selected) {
      const item = enriched[movie.movieCd];
      if (!item) {
        map.set(movie.movieCd, { state: "loading" });
        continue;
      }
      if (item.subscription === null) {
        map.set(movie.movieCd, { state: "unknown" });
        continue;
      }
      if (item.subscription.length === 0) {
        map.set(movie.movieCd, { state: "none", rentOrBuyCount: item.rentOrBuyCount });
        continue;
      }

      const planIds: string[] = [];
      const unpricedProviders: string[] = [];
      for (const provider of item.subscription) {
        const plan = findPlanByTmdbName(provider.name);
        if (plan) planIds.push(plan.id);
        else unpricedProviders.push(provider.name);
      }
      map.set(movie.movieCd, { state: "available", planIds, unpricedProviders });
    }
    return map;
  }, [selected, enriched]);

  /** 요금을 아는 OTT로 실제로 커버 가능한 작품들 */
  const coverableMovies = useMemo(
    () =>
      selected.filter((movie) => {
        const coverage = coverageByMovie.get(movie.movieCd);
        return coverage?.state === "available" && coverage.planIds.length > 0;
      }),
    [selected, coverageByMovie],
  );

  const unavailableMovies = useMemo(
    () => selected.filter((movie) => coverageByMovie.get(movie.movieCd)?.state === "none"),
    [selected, coverageByMovie],
  );

  const unknownMovies = useMemo(
    () => selected.filter((movie) => coverageByMovie.get(movie.movieCd)?.state === "unknown"),
    [selected, coverageByMovie],
  );

  const stillLoading = useMemo(
    () => selected.some((movie) => coverageByMovie.get(movie.movieCd)?.state === "loading"),
    [selected, coverageByMovie],
  );

  const planStats = useMemo(() => {
    return OTT_PLANS.map((plan) => {
      const coveredMovies = selected.filter((movie) => {
        const coverage = coverageByMovie.get(movie.movieCd);
        return coverage?.state === "available" && coverage.planIds.includes(plan.id);
      });

      return {
        ...plan,
        coveredMovies,
        coverage: selected.length ? coveredMovies.length / selected.length : 0,
        costPerMovie: coveredMovies.length
          ? Math.round(plan.price / coveredMovies.length)
          : null,
      };
    })
      .filter((plan) => plan.coveredMovies.length > 0)
      .sort((a, b) => {
        if (b.coveredMovies.length !== a.coveredMovies.length) {
          return b.coveredMovies.length - a.coveredMovies.length;
        }
        if ((a.costPerMovie ?? Infinity) !== (b.costPerMovie ?? Infinity)) {
          return (a.costPerMovie ?? Infinity) - (b.costPerMovie ?? Infinity);
        }
        return a.price - b.price;
      });
  }, [selected, coverageByMovie]);

  const bestSingle = planStats[0];

  /** 커버 가능한 작품을 모두 볼 수 있는 최소비용 조합 */
  const bestCombination = useMemo(() => {
    if (!coverableMovies.length) return null;

    let best: { plans: OttPlan[]; price: number } | null = null;

    for (let mask = 1; mask < 1 << OTT_PLANS.length; mask += 1) {
      const plans = OTT_PLANS.filter((_, index) => mask & (1 << index));

      const coversAll = coverableMovies.every((movie) => {
        const coverage = coverageByMovie.get(movie.movieCd);
        if (coverage?.state !== "available") return false;
        return coverage.planIds.some((planId) => plans.some((plan) => plan.id === planId));
      });
      if (!coversAll) continue;

      const price = plans.reduce((sum, plan) => sum + plan.price, 0);
      if (!best || price < best.price || (price === best.price && plans.length < best.plans.length)) {
        best = { plans, price };
      }
    }

    return best;
  }, [coverableMovies, coverageByMovie]);

  const availableSearchResults = searchResults.filter(
    (movie) => !selected.some((picked) => picked.movieCd === movie.movieCd),
  );

  function addMovie(movie: KobisMovieSummary) {
    if (selected.length >= MAX_SELECTED) return;
    if (selected.some((picked) => picked.movieCd === movie.movieCd)) return;
    setSelected((current) => [...current, movie]);
    setSearchTerm("");
  }

  function removeMovie(movieCd: string) {
    setSelected((current) => current.filter((movie) => movie.movieCd !== movieCd));
  }

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="glow glow-one" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <WalletCards className="size-4" />
                구독 효용 계산기
              </p>
              <h1 className="mt-4 max-w-3xl text-balance break-keep text-[clamp(2.3rem,5vw,4.5rem)] font-black leading-[1.2] tracking-[-0.05em]">
                보고 싶은 5편,<br />어디를 구독해야 할까요?
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">
                작품을 고르면 OTT별 보유 편수와 월요금을 함께 계산해
                가장 효율적인 선택을 보여드려요.
              </p>
            </div>
            <div className="w-full max-w-52 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">선택한 작품</span>
                <strong className="text-brand">
                  {selected.length} / {MAX_SELECTED}
                </strong>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: String((selected.length / MAX_SELECTED) * 100) + "%" }}
                />
              </div>
            </div>
          </div>

          <div className="mt-9 rounded-[1.5rem] border border-white/10 bg-white/[0.065] p-4 backdrop-blur sm:p-5">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="비교할 영화 검색"
                className="h-14 rounded-2xl border-0 bg-white pl-12 pr-4 text-base text-ink placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand"
                disabled={selected.length >= MAX_SELECTED}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={
                  selected.length >= MAX_SELECTED
                    ? `최대 ${MAX_SELECTED}편을 선택했어요`
                    : "비교할 영화 제목을 검색하세요"
                }
                value={searchTerm}
              />
            </div>

            {selected.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.map((movie) => (
                  <span
                    className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-2 text-sm font-bold text-ink"
                    key={movie.movieCd}
                  >
                    {movie.titleKo}
                    <span className="text-xs font-medium opacity-70">{movie.prdtYear}</span>
                    <button
                      aria-label={movie.titleKo + " 선택 해제"}
                      className="grid size-5 place-items-center rounded-full bg-ink/10 transition-colors hover:bg-ink/20"
                      onClick={() => removeMovie(movie.movieCd)}
                      type="button"
                    >
                      <X className="size-3.5" strokeWidth={2.6} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {selected.length < MAX_SELECTED && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                  {searchTerm.trim() ? "검색 결과" : "제목을 검색해 작품을 담아보세요"}
                </p>

                {searchStatus === "loading" && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-white/50">
                    <Loader2 className="size-4 animate-spin" />
                    검색 중이에요...
                  </p>
                )}

                {searchStatus === "error" && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-white/60">
                    <AlertCircle className="size-4" />
                    검색에 실패했어요. 잠시 후 다시 시도해주세요.
                  </p>
                )}

                {searchStatus === "success" && availableSearchResults.length === 0 && (
                  <div className="mt-2 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-white/80">검색 결과가 없어요.</p>
                    <p className="mt-1 text-xs text-white/45">
                      제목을 다시 확인하거나 다른 작품을 검색해주세요.
                    </p>
                  </div>
                )}

                {availableSearchResults.length > 0 && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {availableSearchResults.map((movie) => (
                      <button
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-left transition-colors hover:border-brand/50 hover:bg-white/10"
                        key={movie.movieCd}
                        onClick={() => addMovie(movie)}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white/90">
                            {movie.titleKo}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-white/38">
                            {[movie.prdtYear, movie.directors.join(", ")].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <Plus className="size-4 shrink-0 text-brand" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">선택 결과</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                가장 효율적인 구독 조합
              </h2>
            </div>
            <p className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
              제공처: TMDB · 요금 데이터 입력일 {PRICES_VERIFIED_ON}
            </p>
          </div>

          {selected.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-card px-6 py-14 text-center">
              <p className="text-lg font-bold">비교할 영화를 한 편 이상 선택해주세요.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                최대 {MAX_SELECTED}편까지 선택할 수 있어요.
              </p>
            </div>
          ) : stillLoading ? (
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-border bg-card px-6 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <p className="font-medium">선택한 작품의 제공처를 확인하는 중이에요...</p>
            </div>
          ) : (
            <>
              {bestSingle && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <article className="relative overflow-hidden rounded-[1.5rem] bg-ink p-6 text-white sm:p-7">
                    <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-brand/10" aria-hidden="true" />
                    <p className="flex items-center gap-2 text-sm font-bold text-brand">
                      <Crown className="size-4" />
                      단일 OTT 효용 1위
                    </p>
                    <h3 className="mt-4 text-3xl font-bold">{bestSingle.name}</h3>
                    <p className="mt-2 text-base text-white/60">
                      선택한 {selected.length}편 중 {bestSingle.coveredMovies.length}편 시청 가능
                    </p>
                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
                      <div>
                        <p className="text-xs text-white/40">월 결제 금액</p>
                        <p className="mt-1 text-2xl font-black text-brand">
                          {formatWon.format(bestSingle.price)}원
                        </p>
                        <p className="mt-0.5 text-xs text-white/35">{bestSingle.planName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/40">시청 가능 작품당</p>
                        <p className="mt-1 text-lg font-bold">
                          {formatWon.format(bestSingle.costPerMovie ?? 0)}원
                        </p>
                      </div>
                    </div>
                  </article>

                  <article className="rounded-[1.5rem] border border-border bg-card p-6 shadow-[0_18px_60px_rgba(25,35,55,0.07)] sm:p-7">
                    <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                      <Sparkles className="size-4 text-amber-500" />
                      최소비용 조합
                    </p>
                    {bestCombination ? (
                      <>
                        <h3 className="mt-4 text-2xl font-bold">
                          {bestCombination.plans.map((plan) => plan.name).join(" + ")}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          구독형에서 확인된 {coverableMovies.length}편을 모두 보려면 이 조합의 월
                          합계가 가장 낮아요.
                        </p>
                        <p className="mt-6 border-t border-border pt-5 text-2xl font-black text-ink">
                          월 {formatWon.format(bestCombination.price)}원
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="mt-4 text-xl font-bold">계산할 수 있는 조합이 없어요.</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          선택한 작품 중 구독형 OTT에서 확인된 작품이 없습니다.
                        </p>
                      </>
                    )}
                  </article>
                </div>
              )}

              {planStats.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-border bg-card">
                  <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-5 py-4 sm:grid-cols-[1.1fr_1.7fr_0.7fr_0.7fr] sm:px-7">
                    <span className="text-sm font-semibold text-muted-foreground">OTT</span>
                    <span className="hidden text-sm font-semibold text-muted-foreground sm:block">
                      볼 수 있는 작품
                    </span>
                    <span className="hidden text-right text-sm font-semibold text-muted-foreground sm:block">
                      포함률
                    </span>
                    <span className="text-right text-sm font-semibold text-muted-foreground">
                      월요금
                    </span>
                  </div>
                  {planStats.map((plan, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-5 py-5 last:border-b-0 sm:grid-cols-[1.1fr_1.7fr_0.7fr_0.7fr] sm:items-center sm:px-7"
                      key={plan.id}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            "grid size-9 place-items-center rounded-xl text-sm font-black " +
                            (index === 0 ? "bg-brand text-ink" : "bg-secondary text-secondary-foreground")
                          }
                        >
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-bold">{plan.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{plan.planName}</p>
                        </div>
                      </div>
                      <div className="hidden min-w-0 sm:block">
                        <p className="truncate text-sm text-muted-foreground">
                          {plan.coveredMovies.map((movie) => movie.titleKo).join(", ")}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: String(plan.coverage * 100) + "%" }}
                            />
                          </div>
                          <span className="w-10 text-right text-sm font-semibold">
                            {plan.coveredMovies.length}/{selected.length}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatWon.format(plan.price)}원</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {plan.costPerMovie
                            ? "편당 " + formatWon.format(plan.costPerMovie) + "원"
                            : "비교 제외"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(unavailableMovies.length > 0 || unknownMovies.length > 0) && (
                <div className="mt-5 grid gap-4 lg:grid-cols-[1.28fr_0.72fr]">
                  <article className="rounded-[1.5rem] border border-border bg-card p-6 sm:p-7">
                    <p className="text-sm font-bold text-muted-foreground">
                      구독으로 해결되지 않는 작품
                    </p>

                    {unavailableMovies.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold">
                          구독형 OTT에서 확인되지 않는 작품 {unavailableMovies.length}편
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {unavailableMovies.map((movie) => {
                            const coverage = coverageByMovie.get(movie.movieCd);
                            const rentOrBuy =
                              coverage?.state === "none" ? coverage.rentOrBuyCount : 0;
                            return (
                              <li className="text-sm text-muted-foreground" key={movie.movieCd}>
                                · {movie.titleKo} ({movie.prdtYear})
                                {rentOrBuy > 0 && " — 대여·구매로는 이용 가능"}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {unknownMovies.length > 0 && (
                      <div className="mt-5">
                        <p className="text-sm font-semibold">제공처를 확인하지 못한 작품</p>
                        <ul className="mt-2 space-y-1.5">
                          {unknownMovies.map((movie) => (
                            <li className="text-sm text-muted-foreground" key={movie.movieCd}>
                              · {movie.titleKo} ({movie.prdtYear})
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          제공처 데이터를 가져오지 못했어요. 이용 가능 여부를 단정할 수 없습니다.
                        </p>
                      </div>
                    )}
                  </article>

                  {unavailableMovies.length > 0 && (
                    <KdiskFlow title={unavailableMovies[0].titleKo} />
                  )}
                </div>
              )}

              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-accent/70 px-5 py-4 text-sm leading-6 text-accent-foreground">
                <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
                <p>
                  <strong>추천 기준:</strong> 볼 수 있는 작품 수를 먼저 비교하고, 같은 경우 작품당
                  비용과 월요금이 낮은 순서로 추천합니다. 제공처는 TMDB 기준이며 월 요금은{" "}
                  {PRICES_VERIFIED_ON} 입력 기준입니다. 아직 공식 요금 검증 전이므로 결제 전 각
                  서비스에서 확인해주세요.
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
