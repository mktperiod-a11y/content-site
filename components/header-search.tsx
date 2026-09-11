"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { fetchMovieSearch, isSearchable } from "@/lib/movie-search";
import type { KobisMovieSummary } from "@/lib/kobis";

/**
 * 헤더 어디에서나 쓰는 전역 검색창.
 *
 * 검색 페이지에서는 `onSearch`로 검색 탭의 결과 영역을 그대로 재사용하고,
 * 그 밖의 페이지에서는 `/search?q=`로 이동해 같은 결과 화면을 보여준다.
 */
export function HeaderSearch({ onSearch }: { onSearch?: (query: string) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<KobisMovieSummary[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  /** 키보드로 이동 중인 자동완성 항목 (-1 = 선택 없음) */
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const suggestionsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    const timer = setTimeout(async () => {
      if (!isSearchable(trimmed)) {
        setSuggestions([]);
        return;
      }

      suggestionsAbortRef.current?.abort();
      const controller = new AbortController();
      suggestionsAbortRef.current = controller;
      try {
        const movies = await fetchMovieSearch(trimmed, 6, controller.signal);
        setSuggestions(movies);
        setActiveSuggestion(-1);
      } catch {
        // 자동완성 실패는 조용히 무시하고, 제출 시 결과 영역에서 오류를 안내한다.
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const suggestionsOpen = showSuggestions && suggestions.length > 0;

  function submitQuery(term: string) {
    const trimmed = term.trim();
    if (!isSearchable(trimmed)) return;

    setShowSuggestions(false);
    setActiveSuggestion(-1);

    if (onSearch) {
      onSearch(trimmed);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      return;
    }

    // 목록이 닫혀 있어도 아래 방향키로 다시 열 수 있어야 한다
    // (Escape로 닫은 뒤 키보드만으로 복구 가능하도록).
    if (event.key === "ArrowDown" && !suggestionsOpen && suggestions.length > 0) {
      event.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestion(0);
      return;
    }

    if (!suggestionsOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeSuggestion >= 0) {
      // 자동완성 선택도 결과 목록을 먼저 거쳐 2뎁스 흐름을 유지한다.
      event.preventDefault();
      suggestionButtonRefs.current[activeSuggestion]?.click();
    }
  }

  return (
    <form
      className="relative w-full sm:w-48 md:w-64 lg:w-80"
      data-ga-event="header_search_submit"
      onSubmit={(event) => {
        event.preventDefault();
        submitQuery(query);
      }}
      role="search"
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45"
      />
      <Input
        role="combobox"
        aria-activedescendant={
          activeSuggestion >= 0 ? `header-search-suggestion-${activeSuggestion}` : undefined
        }
        aria-autocomplete="list"
        aria-controls="header-search-suggestions"
        aria-expanded={suggestionsOpen}
        aria-haspopup="listbox"
        aria-label="작품명 검색"
        className="h-10 rounded-xl border-white/12 bg-white/[0.06] pl-9 pr-3 text-sm font-medium text-white shadow-none placeholder:text-white/40 focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/35"
        onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          setShowSuggestions(true);
          setActiveSuggestion(-1);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        minLength={2}
        placeholder="영화 제목 또는 감독명 검색"
        value={query}
      />

      {suggestionsOpen && (
        <ul
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-80 overflow-auto rounded-2xl border border-border bg-card p-1.5 shadow-2xl"
          id="header-search-suggestions"
          role="listbox"
        >
          {suggestions.map((movie, index) => (
            <li
              aria-selected={index === activeSuggestion}
              id={`header-search-suggestion-${index}`}
              key={movie.movieCd}
              role="option"
            >
              <button
                className={
                  "flex w-full flex-col gap-0.5 rounded-xl px-3.5 py-2.5 text-left text-ink hover:bg-accent/50 " +
                  (index === activeSuggestion ? "bg-accent/60" : "")
                }
                data-ga-event="header_search_suggestion_select"
                onMouseEnter={() => setActiveSuggestion(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery(movie.titleKo);
                  submitQuery(movie.titleKo);
                }}
                ref={(node) => {
                  suggestionButtonRefs.current[index] = node;
                }}
                type="button"
              >
                <span className="truncate font-semibold">{movie.titleKo}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[movie.prdtYear, movie.directors.join(", ")].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

