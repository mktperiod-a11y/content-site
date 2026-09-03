"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Check,
  Clapperboard,
  History,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EXAMPLE_TITLE = "조제, 호랑이 그리고 물고기들";

export default function Home() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    setSubmittedQuery(normalizedQuery);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <a className="flex items-center gap-2.5 font-semibold tracking-tight" href="#top">
            <span className="grid size-8 place-items-center rounded-xl bg-brand text-ink">
              <Clapperboard className="size-4.5" strokeWidth={2.4} />
            </span>
            <span>어디서 보지?</span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-white/65 sm:flex" aria-label="주요 메뉴">
            <a className="transition-colors hover:text-white" href="#search">콘텐츠 찾기</a>
            <a className="transition-colors hover:text-white" href="#guide">이용 가이드</a>
          </nav>

          <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/60">
            국내 제공처 기준
          </span>
        </div>
      </header>

      <section id="top" className="relative bg-ink text-white">
        <div className="glow glow-one" aria-hidden="true" />
        <div className="glow glow-two" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-brand">
              <span className="size-1.5 rounded-full bg-brand shadow-[0_0_14px_#ffd84d]" />
              작품별 시청 가능한 곳을 한 번에
            </p>
            <h1 className="max-w-3xl text-balance text-[clamp(2.7rem,7vw,5.8rem)] font-bold leading-[0.98] tracking-[-0.055em]">
              보고 싶은 제목만<br />입력하세요.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/62">
              흩어진 OTT 구독·대여·구매 정보를 확인하고,
              지금 가장 효율적인 선택을 찾아보세요.
            </p>

            <form
              id="search"
              className="mt-10 flex max-w-2xl flex-col gap-3 rounded-[1.45rem] border border-white/12 bg-white/7 p-2.5 shadow-2xl shadow-black/25 backdrop-blur sm:flex-row"
              onSubmit={handleSubmit}
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="작품명 검색"
                  className="h-14 rounded-2xl border-0 bg-white pl-12 pr-4 text-base text-ink shadow-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="영화·드라마·애니메이션 제목 검색"
                  value={query}
                />
              </div>
              <Button
                className="h-14 rounded-2xl bg-brand px-6 text-base font-bold text-ink shadow-[0_10px_30px_rgba(255,216,77,0.2)] hover:bg-brand-bright"
                type="submit"
              >
                찾아보기
                <ArrowRight className="size-4.5" />
              </Button>
            </form>

            <button
              className="mt-4 inline-flex items-center gap-2 text-left text-sm text-white/48 transition-colors hover:text-white/75"
              onClick={() => setQuery(EXAMPLE_TITLE)}
              type="button"
            >
              <History className="size-4" />
              검색 예시: {EXAMPLE_TITLE}
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

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14" aria-live="polite">
        {submittedQuery ? (
          <div className="result-enter overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_22px_70px_rgba(25,35,55,0.08)]">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="text-sm font-medium text-muted-foreground">검색한 작품</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{submittedQuery}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  상세 제공처 데이터 연결은 다음 단계에서 진행합니다.
                </p>
              </div>
              <span className="w-fit rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground">
                검색 화면 1차 구현
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-l-2 border-brand pl-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">어떤 작품이든 제목부터 검색해보세요.</p>
              <p className="mt-1 text-sm text-muted-foreground">정확한 제공처만 확인할 수 있도록 데이터 기준을 설계하고 있습니다.</p>
            </div>
            <p className="text-sm font-medium text-muted-foreground">정보 우선 · 브랜드 노출 최소화</p>
          </div>
        )}
      </section>
    </main>
  );
}
