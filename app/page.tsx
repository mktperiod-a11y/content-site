"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  History,
  Loader2,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader } from "@/components/site-header";
import { PriceComparison } from "@/app/price-comparison";
import type { KobisMovieSummary } from "@/lib/kobis";

const EXAMPLE_TITLE = "조제, 호랑이 그리고 물고기들";

type SearchStatus = "idle" | "loading" | "success" | "error";

async function fetchMovieSearch(query: string, limit: number, signal: AbortSignal) {
  const url = new URL("/api/movies/search", window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { signal });
  const body = (await response.json()) as { movies?: KobisMovieSummary[]; error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "검색 중 오류가 발생했어요.");
  }
  return body.movies ?? [];
}

function ResultCard({ movie }: { movie: KobisMovieSummary }) {
  return (
    <Link
      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand/60 hover:bg-accent/30"
      data-ga-event="search_result_select"
      href={`/movie/${movie.movieCd}`}
    >
      <div className="min-w-0">
        <p className="truncate font-bold">{movie.titleKo}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {[movie.prdtYear, movie.directors.join(", "), movie.genreAlt]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<string>(
    searchParams.get("tab") === "compare" ? "compare" : "search",
  );
  const compareAddId = searchParams.get("add") ?? undefined;

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<KobisMovieSummary[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<KobisMovieSummary[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const resultRef = useRef<HTMLElement>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    const timer = setTimeout(async () => {
      if (!trimmed) {
        setSuggestions([]);
        return;
      }

      suggestionsAbortRef.current?.abort();
      const controller = new AbortController();
      suggestionsAbortRef.current = controller;
      try {
        const movies = await fetchMovieSearch(trimmed, 6, controller.signal);
        setSuggestions(movies);
      } catch {
        // 자동완성 실패는 조용히 무시하고, 제출 시 결과 영역에서 오류를 안내한다.
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  async function runSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;

    setSubmittedQuery(trimmed);
    setShowSuggestions(false);
    setStatus("loading");
    setErrorMessage("");
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    try {
      const movies = await fetchMovieSearch(trimmed, 20, controller.signal);
      setResults(movies);
      setStatus("success");
    } catch (error) {
      if (controller.signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "검색 중 오류가 발생했어요.");
      setStatus("error");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  function showExample() {
    setQuery(EXAMPLE_TITLE);
    void runSearch(EXAMPLE_TITLE);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <SiteHeader />

      <Tabs className="gap-0" onValueChange={setTab} value={tab}>
        <div className="border-b border-white/10 bg-ink">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <TabsList
              aria-label="주요 기능"
              className="h-12 w-full justify-start gap-6 rounded-none bg-transparent p-0 sm:w-auto"
              variant="line"
            >
              <TabsTrigger
                className="h-12 flex-none border-0 bg-transparent px-0 text-white/50 shadow-none after:bg-brand data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
                value="search"
              >
                영화 찾기
              </TabsTrigger>
              <TabsTrigger
                className="h-12 flex-none border-0 bg-transparent px-0 text-white/50 shadow-none after:bg-brand data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
                value="compare"
              >
                가격 비교하기
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent className="mt-0" value="search">
          <section id="top" className="relative bg-ink text-white">
            <div className="glow glow-one" aria-hidden="true" />
            <div className="glow glow-two" aria-hidden="true" />

            <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:grid-cols-[1fr_0.72fr] lg:items-end">
              <div>
                <p className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-brand">
                  <span className="size-1.5 rounded-full bg-brand shadow-[0_0_14px_#ffd84d]" />
                  작품별 시청 가능한 곳을 한 번에
                </p>
                <h1 className="max-w-3xl text-balance break-keep text-[clamp(2.7rem,7vw,5.8rem)] font-bold leading-[0.98] tracking-[-0.055em]">
                  이 영화, OTT에
                  <br />
                  있나요?
                </h1>
                <p className="mt-6 max-w-xl break-keep text-lg leading-8 text-white/62">
                  제목만 입력하면 바로 알려드려요. 국내 주요 OTT의 구독·대여·구매 여부를
                  한 번에 확인하고, 가장 합리적인 시청 방법을 찾아보세요.
                </p>

                <form
                  id="search"
                  className="relative mt-10 flex max-w-2xl flex-col gap-3 rounded-[1.45rem] border border-white/12 bg-white/7 p-2.5 shadow-2xl shadow-black/25 backdrop-blur sm:flex-row"
                  onSubmit={handleSubmit}
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls="search-suggestions"
                      aria-expanded={showSuggestions && suggestions.length > 0}
                      aria-haspopup="listbox"
                      aria-label="작품명 검색"
                      className="h-14 rounded-2xl border-0 bg-white pl-12 pr-4 text-base text-ink shadow-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand"
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="영화·드라마·애니메이션 제목, 감독명으로 검색"
                      value={query}
                    />

                    {showSuggestions && suggestions.length > 0 && (
                      <ul
                        className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-80 overflow-auto rounded-2xl border border-border bg-card p-1.5 shadow-2xl"
                        id="search-suggestions"
                        role="listbox"
                      >
                        {suggestions.map((movie) => (
                          <li key={movie.movieCd} role="option" aria-selected="false">
                            <Link
                              className="flex flex-col gap-0.5 rounded-xl px-3.5 py-2.5 text-left text-ink hover:bg-accent/50"
                              data-ga-event="search_suggestion_select"
                              href={`/movie/${movie.movieCd}`}
                            >
                              <span className="truncate font-semibold">{movie.titleKo}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {[movie.prdtYear, movie.directors.join(", ")]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Button
                    className="h-14 rounded-2xl bg-brand px-6 text-base font-bold text-ink shadow-[0_10px_30px_rgba(255,216,77,0.2)] hover:bg-brand-bright"
                    data-ga-event="search_submit"
                    type="submit"
                  >
                    찾아보기
                    <ArrowRight className="size-4.5" />
                  </Button>
                </form>

                <button
                  className="mt-4 inline-flex items-center gap-2 text-left text-sm text-white/48 transition-colors hover:text-white/75"
                  onClick={showExample}
                  type="button"
                >
                  <History className="size-4" />
                  예시 결과 보기: {EXAMPLE_TITLE}
                </button>
              </div>

              <div id="guide" className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-sm sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
                  검색 결과에서 확인할 수 있어요
                </p>
                <ul className="mt-6 space-y-5">
                  {[
                    ["현재 이용 가능한 곳", "구독·대여·구매를 구분해서 확인"],
                    ["내게 맞는 이용 방식", "여러 서비스를 헤매지 않고 비교"],
                    ["정보 출처와 갱신일", "변경될 수 있는 제공 정보를 투명하게"],
                  ].map(([title, description]) => (
                    <li className="flex gap-3.5" key={title}>
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                        <Check className="size-3.5" strokeWidth={2.8} />
                      </span>
                      <div>
                        <p className="font-semibold text-white/92">{title}</p>
                        <p className="mt-1 text-sm leading-6 text-white/45">{description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section ref={resultRef} className="scroll-mt-6 px-5 py-10 sm:px-8 sm:py-14" aria-live="polite">
            <div className="mx-auto max-w-6xl">
              {status === "idle" && (
                <div className="flex flex-col gap-3 border-l-2 border-brand pl-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">어떤 작품이든 제목부터 검색해보세요.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      제목 일부, 영문·원제, 감독명으로도 검색할 수 있어요.
                    </p>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">정보 우선 · 브랜드 노출 최소화</p>
                </div>
              )}

              {status === "loading" && (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-8 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  <p className="font-medium">&ldquo;{submittedQuery}&rdquo; 검색하는 중이에요...</p>
                </div>
              )}

              {status === "error" && (
                <div className="flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div>
                      <p className="font-bold text-destructive">검색을 완료하지 못했어요.</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{errorMessage}</p>
                    </div>
                  </div>
                  <Button className="rounded-xl" onClick={() => runSearch(submittedQuery)} variant="outline">
                    다시 시도하기
                  </Button>
                </div>
              )}

              {status === "success" && (
                <div className="result-enter space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        &ldquo;{submittedQuery}&rdquo; 검색 결과
                      </p>
                      <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                        {results.length > 0 ? `${results.length}개 작품을 찾았어요` : "검색 결과가 없어요"}
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">기본 정보 출처: KOBIS(영화진흥위원회)</p>
                  </div>

                  {results.length > 0 ? (
                    <div className="grid gap-3">
                      {results.map((movie) => (
                        <ResultCard key={movie.movieCd} movie={movie} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-border bg-card px-6 py-12 text-center">
                      <p className="text-lg font-bold">검색 결과가 없어요.</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        제목을 다시 확인하거나 다른 작품을 검색해주세요.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent className="mt-0" value="compare">
          <PriceComparison
            initialAddId={compareAddId}
            onInitialAddHandled={() => {
              if (searchParams.get("add")) {
                router.replace("/?tab=compare");
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
