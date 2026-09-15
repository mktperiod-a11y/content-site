import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  ExternalLink,
  MonitorPlay,
  Popcorn,
  Ticket,
} from "lucide-react";

import { SiteHeader } from "@/components/site-header";

const KDISK_HOME_URL = "https://m.kdisk.co.kr/";

const OPTIONS = [
  {
    title: "구독형 OTT",
    description: "월 요금을 내고 서비스가 제공하는 작품을 이용하는 방식",
    icon: MonitorPlay,
  },
  {
    title: "작품 대여·구매",
    description: "필요한 작품을 일정 기간 대여하거나 개별 구매하는 방식",
    icon: BadgeDollarSign,
  },
  {
    title: "극장·VOD",
    description: "극장 상영 또는 IPTV와 온라인 VOD로 이용하는 방식",
    icon: Ticket,
  },
  {
    title: "작품별 콘텐츠 이용 서비스",
    description: "구독 대신 원하는 콘텐츠를 직접 찾아 이용하는 방식",
    icon: Popcorn,
  },
] as const;

export const metadata = {
  title: "구독 외 이용 방식 | 어디서 보지?",
  description: "구독형 OTT 외에 작품을 이용할 수 있는 방식을 비교해보세요.",
};

export default function WatchOptionsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16 lg:min-h-[27rem] lg:pt-16">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-4 text-sm font-bold text-white transition-colors hover:border-brand hover:text-brand"
            href="/search?tab=compare"
          >
            <ArrowLeft className="size-4" />
            가격 비교로 돌아가기
          </Link>
          <p className="mt-10 text-sm font-bold text-brand">구독 외 이용 방식</p>
          <h1 className="mt-4 max-w-3xl break-keep text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[1.05] tracking-[-0.025em]">
            콘텐츠를 이용하는 방법은
            <br />
            구독만 있는 것이 아니에요.
          </h1>
          <p className="mt-6 max-w-3xl break-keep text-base leading-7 text-on-dark-secondary sm:text-lg">
            보고 싶은 작품과 이용 빈도에 따라 대여·구매, 극장·VOD, 작품별 이용 서비스가
            더 알맞을 수 있어요.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold text-muted-foreground">이용 방식 비교</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          이용 방식의 차이를 먼저 확인해보세요.
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <article
                className="flex items-center gap-4 rounded-[1.5rem] border border-border bg-card px-6 py-7"
                key={option.title}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold">{option.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <article className="mt-10 flex flex-col gap-7 rounded-[1.7rem] bg-ink px-7 py-8 text-white shadow-[0_22px_70px_rgba(25,35,55,0.14)] sm:px-9 sm:py-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-brand">작품별 콘텐츠 이용 서비스</p>
            <h2 className="mt-3 text-3xl font-bold">KDisk</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-on-dark-secondary">
              KDisk는 필요한 콘텐츠를 작품별로 찾아 이용할 수 있는 서비스입니다.
            </p>
            <p className="mt-2 text-sm leading-6 text-on-dark-tertiary">
              실제 제공 여부와 이용 조건은 KDisk 검색 결과에서 확인해주세요.
            </p>
          </div>
          <a
            className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-ink transition-colors hover:bg-brand-bright"
            data-ga-event="kdisk_service_outbound_click"
            href={KDISK_HOME_URL}
            rel="noreferrer"
            target="_blank"
          >
            KDisk 서비스 알아보기
            <ExternalLink className="size-4" />
          </a>
        </article>

        <Link
          className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-brand-muted"
          href="/search?tab=compare"
        >
          가격 비교 결과로 돌아가기
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </main>
  );
}
