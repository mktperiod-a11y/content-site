"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Crown,
  Plus,
  Search,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { MOVIES, PROVIDER_CATALOG, normalizeSearchValue, type Movie } from "@/lib/movies";

type ProviderPlan = {
  id: string;
  name: string;
  price: number;
  plan: string;
};

const PROVIDER_PLANS: ProviderPlan[] = Object.entries(PROVIDER_CATALOG).map(
  ([id, catalog]) => ({ id, ...catalog }),
);

const DEFAULT_SELECTED_IDS = ["jose-2003", "exhuma"];

const formatWon = new Intl.NumberFormat("ko-KR");

export function PriceComparison({
  initialAddId,
  onInitialAddHandled,
}: {
  initialAddId?: string;
  onInitialAddHandled?: () => void;
} = {}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_SELECTED_IDS);
  const [searchTerm, setSearchTerm] = useState("");
  const handledAddId = useRef<string | null>(null);
  // onInitialAddHandled is typically a fresh inline function on every parent
  // render. Keeping it out of the effect's dependency array (via a ref) stops
  // the effect from tearing down and rescheduling its own setTimeout on every
  // unrelated re-render, which previously cancelled the timer before it fired.
  const onInitialAddHandledRef = useRef(onInitialAddHandled);
  useEffect(() => {
    onInitialAddHandledRef.current = onInitialAddHandled;
  });

  useEffect(() => {
    if (!initialAddId || handledAddId.current === initialAddId) return;
    handledAddId.current = initialAddId;

    const timer = setTimeout(() => {
      if (MOVIES.some((movie) => movie.id === initialAddId)) {
        setSelectedIds((current) =>
          current.includes(initialAddId) || current.length >= 5
            ? current
            : [...current, initialAddId],
        );
      }
      onInitialAddHandledRef.current?.();
    }, 0);

    return () => clearTimeout(timer);
  }, [initialAddId]);

  const selectedMovies = useMemo(
    () => selectedIds.map((id) => MOVIES.find((movie) => movie.id === id)).filter(Boolean) as Movie[],
    [selectedIds],
  );

  const searchResults = useMemo(() => {
    const normalized = normalizeSearchValue(searchTerm);
    return MOVIES.filter(
      (movie) =>
        !selectedIds.includes(movie.id) &&
        (!normalized ||
          normalizeSearchValue(movie.titleKo).includes(normalized) ||
          movie.year.includes(searchTerm.trim())),
    );
  }, [searchTerm, selectedIds]);

  const providerStats = useMemo(
    () =>
      PROVIDER_PLANS.map((provider) => {
        const coveredMovies = selectedMovies.filter((movie) =>
          movie.providers.some((p) => p.id === provider.id && p.offers.includes("구독")),
        );

        return {
          ...provider,
          coveredMovies,
          coverage: selectedMovies.length
            ? coveredMovies.length / selectedMovies.length
            : 0,
          costPerMovie: coveredMovies.length
            ? Math.round(provider.price / coveredMovies.length)
            : null,
        };
      }).sort((a, b) => {
        if (b.coveredMovies.length !== a.coveredMovies.length) {
          return b.coveredMovies.length - a.coveredMovies.length;
        }
        if ((a.costPerMovie ?? Infinity) !== (b.costPerMovie ?? Infinity)) {
          return (a.costPerMovie ?? Infinity) - (b.costPerMovie ?? Infinity);
        }
        return a.price - b.price;
      }),
    [selectedMovies],
  );

  const bestSingle = providerStats.find((provider) => provider.coveredMovies.length > 0);

  const bestCombination = useMemo(() => {
    if (!selectedMovies.length) return null;

    let best: { providers: ProviderPlan[]; price: number } | null = null;

    for (let mask = 1; mask < 1 << PROVIDER_PLANS.length; mask += 1) {
      const providers = PROVIDER_PLANS.filter((_, index) => mask & (1 << index));
      const coveredIds = new Set(
        selectedMovies
          .filter((movie) =>
            movie.providers.some(
              (p) => p.offers.includes("구독") && providers.some((provider) => provider.id === p.id),
            ),
          )
          .map((movie) => movie.id),
      );

      if (coveredIds.size !== selectedMovies.length) continue;

      const price = providers.reduce((sum, provider) => sum + provider.price, 0);
      if (
        !best ||
        price < best.price ||
        (price === best.price && providers.length < best.providers.length)
      ) {
        best = { providers, price };
      }
    }

    return best;
  }, [selectedMovies]);

  function addMovie(movieId: string) {
    if (selectedIds.length >= 5 || selectedIds.includes(movieId)) return;
    setSelectedIds((current) => [...current, movieId]);
    setSearchTerm("");
  }

  function removeMovie(movieId: string) {
    setSelectedIds((current) => current.filter((id) => id !== movieId));
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
                <strong className="text-brand">{selectedIds.length} / 5</strong>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: String((selectedIds.length / 5) * 100) + "%" }}
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
                disabled={selectedIds.length >= 5}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={selectedIds.length >= 5 ? "최대 5편을 선택했어요" : "비교할 영화 제목을 검색하세요"}
                value={searchTerm}
              />
            </div>

            {selectedMovies.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedMovies.map((movie) => (
                  <span
                    className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-2 text-sm font-bold text-ink"
                    key={movie.id}
                  >
                    {movie.titleKo}
                    <button
                      aria-label={movie.titleKo + " 선택 해제"}
                      className="grid size-5 place-items-center rounded-full bg-ink/10 transition-colors hover:bg-ink/20"
                      onClick={() => removeMovie(movie.id)}
                      type="button"
                    >
                      <X className="size-3.5" strokeWidth={2.6} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {selectedIds.length < 5 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                  {searchTerm.trim() ? "검색 결과" : "이런 영화도 있어요"}
                </p>

                {searchResults.length > 0 ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {searchResults.slice(0, 8).map((movie) => (
                      <button
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-left transition-colors hover:border-brand/50 hover:bg-white/10"
                        key={movie.id}
                        onClick={() => addMovie(movie.id)}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white/90">{movie.titleKo}</span>
                          <span className="mt-0.5 block text-xs text-white/38">{movie.year}</span>
                        </span>
                        <Plus className="size-4 shrink-0 text-brand" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-white/80">검색 결과가 없어요.</p>
                    <p className="mt-1 text-xs text-white/45">
                      제목을 다시 확인하거나 다른 작품을 검색해주세요.
                    </p>
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
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">가장 효율적인 구독 조합</h2>
            </div>
            <p className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
              기능 검토용 예시 가격·보유 정보
            </p>
          </div>

          {selectedMovies.length > 0 && bestSingle ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="relative overflow-hidden rounded-[1.5rem] bg-ink p-6 text-white sm:p-7">
                  <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-brand/10" aria-hidden="true" />
                  <p className="flex items-center gap-2 text-sm font-bold text-brand">
                    <Crown className="size-4" />
                    단일 OTT 효용 1위
                  </p>
                  <h3 className="mt-4 text-3xl font-bold">{bestSingle.name}</h3>
                  <p className="mt-2 text-base text-white/60">
                    선택한 {selectedMovies.length}편 중 {bestSingle.coveredMovies.length}편 시청 가능
                  </p>
                  <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
                    <div>
                      <p className="text-xs text-white/40">월 결제 금액</p>
                      <p className="mt-1 text-2xl font-black text-brand">{formatWon.format(bestSingle.price)}원</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40">시청 가능 작품당</p>
                      <p className="mt-1 text-lg font-bold">{formatWon.format(bestSingle.costPerMovie ?? 0)}원</p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[1.5rem] border border-border bg-card p-6 shadow-[0_18px_60px_rgba(25,35,55,0.07)] sm:p-7">
                  <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                    <Sparkles className="size-4 text-amber-500" />
                    전 작품 최소비용 조합
                  </p>
                  {bestCombination ? (
                    <>
                      <h3 className="mt-4 text-2xl font-bold">
                        {bestCombination.providers.map((provider) => provider.name).join(" + ")}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        선택한 작품을 모두 보려면 이 조합의 월 합계가 가장 낮아요.
                      </p>
                      <p className="mt-6 border-t border-border pt-5 text-2xl font-black text-ink">
                        월 {formatWon.format(bestCombination.price)}원
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="mt-4 text-xl font-bold">모든 작품을 포함하는 조합이 없어요.</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        공식 제공처가 확인되지 않은 작품은 KDisk·OnDisk의 공식 보유 여부를 추가 확인합니다.
                      </p>
                    </>
                  )}
                </article>
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-border bg-card">
                <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-5 py-4 sm:grid-cols-[1.1fr_1.7fr_0.7fr_0.7fr] sm:px-7">
                  <span className="text-sm font-semibold text-muted-foreground">OTT</span>
                  <span className="hidden text-sm font-semibold text-muted-foreground sm:block">볼 수 있는 작품</span>
                  <span className="hidden text-right text-sm font-semibold text-muted-foreground sm:block">포함률</span>
                  <span className="text-right text-sm font-semibold text-muted-foreground">월요금</span>
                </div>
                {providerStats.map((provider, index) => (
                  <div
                    className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-5 py-5 last:border-b-0 sm:grid-cols-[1.1fr_1.7fr_0.7fr_0.7fr] sm:items-center sm:px-7"
                    key={provider.id}
                  >
                    <div className="flex items-center gap-3">
                      <span className={"grid size-9 place-items-center rounded-xl text-sm font-black " + (index === 0 ? "bg-brand text-ink" : "bg-secondary text-secondary-foreground")}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-bold">{provider.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{provider.plan}</p>
                      </div>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      {provider.coveredMovies.length ? (
                        <p className="truncate text-sm text-muted-foreground">
                          {provider.coveredMovies.map((movie) => movie.titleKo).join(", ")}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">해당 작품 없음</p>
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-brand" style={{ width: String(provider.coverage * 100) + "%" }} />
                        </div>
                        <span className="w-10 text-right text-sm font-semibold">
                          {provider.coveredMovies.length}/{selectedMovies.length}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatWon.format(provider.price)}원</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {provider.costPerMovie ? "편당 " + formatWon.format(provider.costPerMovie) + "원" : "비교 제외"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-accent/70 px-5 py-4 text-sm leading-6 text-accent-foreground">
                <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.8} />
                <p><strong>추천 기준:</strong> 볼 수 있는 작품 수를 먼저 비교하고, 같은 경우 작품당 비용과 월요금이 낮은 순서로 추천합니다.</p>
              </div>
            </>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-card px-6 py-14 text-center">
              <p className="text-lg font-bold">비교할 영화를 한 편 이상 선택해주세요.</p>
              <p className="mt-2 text-sm text-muted-foreground">최대 5편까지 선택할 수 있어요.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
