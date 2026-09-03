"use client";

import { FormEvent, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clapperboard,
  Copy,
  ExternalLink,
  History,
  Info,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const EXAMPLE_TITLE = "조제, 호랑이 그리고 물고기들";
const KDISK_SIGNUP_URL = "https://m.kdisk.co.kr/web/member/join.html";

const PROVIDERS = [
  { name: "Wavve", offers: ["구독", "대여", "구매"] },
  { name: "Watcha", offers: ["구독"] },
  { name: "TVING", offers: ["구독"] },
];

function normalizeTitle(value: string) {
  return value.replace(/[\s,·:]/g, "").toLowerCase();
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLElement>(null);

  const isExampleResult =
    normalizeTitle(submittedQuery) === normalizeTitle(EXAMPLE_TITLE);

  function revealResult(title: string) {
    setSubmittedQuery(title);
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    revealResult(normalizedQuery);
  }

  function showExample() {
    setQuery(EXAMPLE_TITLE);
    revealResult(EXAMPLE_TITLE);
  }

  async function prepareKdiskFlow() {
    let didCopy = false;

    try {
      await navigator.clipboard.writeText(submittedQuery);
      didCopy = true;
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = submittedQuery;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      didCopy = document.execCommand("copy");
      textArea.remove();
    }

    setCopied(didCopy);
    setDialogOpen(true);
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

      <section
        ref={resultRef}
        className="scroll-mt-6 px-5 py-10 sm:px-8 sm:py-14"
        aria-live="polite"
      >
        <div className="mx-auto max-w-6xl">
          {submittedQuery && isExampleResult ? (
            <div className="result-enter space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                      2차 프로토타입 예시
                    </span>
                    <span className="text-sm text-muted-foreground">2003 · 영화 · 1시간 56분 · 15세</span>
                  </div>
                  <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                    {submittedQuery}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">ジョゼと虎と魚たち · 드라마·로맨스</p>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  제공처 확인 · 2026.08.28
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.28fr_0.72fr]">
                <article className="overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_22px_70px_rgba(25,35,55,0.08)]">
                  <div className="border-b border-border px-6 py-5 sm:px-8">
                    <p className="text-sm font-medium text-muted-foreground">공식 OTT 제공처</p>
                    <p className="mt-1 text-lg font-bold">현재 3개 구독 서비스에서 확인됐어요</p>
                  </div>
                  <div className="divide-y divide-border px-6 sm:px-8">
                    {PROVIDERS.map((provider) => (
                      <div className="flex items-center justify-between gap-4 py-5" key={provider.name}>
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-xl bg-ink text-sm font-black text-brand">
                            {provider.name.slice(0, 1)}
                          </span>
                          <span className="font-bold">{provider.name}</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {provider.offers.map((offer) => (
                            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground" key={offer}>
                              {offer}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-2.5 bg-muted/65 px-6 py-4 text-sm leading-6 text-muted-foreground sm:px-8">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <p>
                      제공 정보는 변경될 수 있어요. 이용 전 각 서비스에서 최종 확인해주세요.{" "}
                      <a
                        className="font-semibold text-foreground underline decoration-border underline-offset-4"
                        href="https://www.justwatch.com/kr/%EC%98%81%ED%99%94/joje-horangi-geurigo-mulgogideul"
                        rel="noreferrer"
                        target="_blank"
                      >
                        정보 출처
                      </a>
                    </p>
                  </div>
                </article>

                <aside className="rounded-[1.6rem] bg-ink p-6 text-white shadow-[0_22px_70px_rgba(25,35,55,0.14)] sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">KDisk 공식 제공 콘텐츠</p>
                    <Sparkles className="size-5 text-brand" />
                  </div>
                  <h3 className="mt-5 text-2xl font-bold leading-tight">이 작품은 KDisk에서도 이용할 수 있어요.</h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">
                    신규 가입 시 1,000B를 즉시 받고, 복사된 작품명으로 바로 검색해보세요.
                  </p>

                  <Button
                    className="mt-7 h-12 w-full rounded-xl bg-brand text-base font-bold text-ink hover:bg-brand-bright"
                    data-content-title={submittedQuery}
                    data-ga-event="kdisk_content_cta_click"
                    onClick={prepareKdiskFlow}
                    type="button"
                  >
                    KDisk에서 이용하기
                    <ArrowRight className="size-4" />
                  </Button>
                  <p className="mt-3 text-center text-xs leading-5 text-white/38">
                    제공 여부가 확인된 작품에만 노출되는 영역입니다.
                  </p>
                </aside>
              </div>
            </div>
          ) : submittedQuery ? (
            <div className="result-enter rounded-[1.6rem] border border-border bg-card p-7 shadow-[0_22px_70px_rgba(25,35,55,0.08)] sm:p-9">
              <p className="text-sm font-medium text-muted-foreground">검색한 작품</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{submittedQuery}</h2>
              <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-muted p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">아직 실제 제공처 데이터 연결 전이에요.</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">현재는 예시 작품으로 전체 검색·가입 흐름을 확인할 수 있습니다.</p>
                </div>
                <Button className="rounded-xl" onClick={showExample} variant="outline">
                  예시 결과 보기
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 border-l-2 border-brand pl-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">어떤 작품이든 제목부터 검색해보세요.</p>
                <p className="mt-1 text-sm text-muted-foreground">예시 작품에서는 제공처 확인부터 KDisk 가입 이동까지 체험할 수 있어요.</p>
              </div>
              <p className="text-sm font-medium text-muted-foreground">정보 우선 · 브랜드 노출 최소화</p>
            </div>
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="overflow-hidden rounded-[1.5rem] border-0 p-0 sm:max-w-md">
          <div className="bg-ink px-6 pb-6 pt-7 text-white">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand text-ink">
              {copied ? <Check className="size-5" strokeWidth={3} /> : <Copy className="size-5" />}
            </span>
            <DialogHeader className="mt-5 text-left">
              <DialogTitle className="text-2xl leading-tight">
                {copied ? "작품명을 복사해뒀어요" : "작품명을 확인해주세요"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-white/58">
                가입을 마친 뒤 KDisk 검색창에 붙여넣으면 됩니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-6">
            <div className="rounded-xl border border-border bg-muted px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">검색할 작품명</p>
              <p className="mt-1 font-bold">{submittedQuery}</p>
            </div>

            <ol className="mt-5 space-y-3 text-sm leading-6">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-accent-foreground">1</span>
                <span>KDisk 무료 회원가입을 완료하세요.</span>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-accent-foreground">2</span>
                <span>검색창에 복사한 작품명을 붙여넣으세요.</span>
              </li>
            </ol>

            <DialogFooter className="mt-6">
              <Button asChild className="h-12 w-full rounded-xl bg-brand text-base font-bold text-ink hover:bg-brand-bright">
                <a
                  data-content-title={submittedQuery}
                  data-ga-event="kdisk_signup_outbound_click"
                  href={KDISK_SIGNUP_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  무료 가입하고 계속하기
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </DialogFooter>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
              가입 혜택은 KDisk 운영 정책에 따라 달라질 수 있어요.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
