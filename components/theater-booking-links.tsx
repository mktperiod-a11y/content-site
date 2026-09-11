import { Clapperboard } from "lucide-react";
import type { TheaterStatus } from "@/lib/theater-catalog";
import type { TheaterCode } from "@/lib/theater-sources";

export const THEATER_BOOKING_LINKS: ReadonlyArray<{
  code: TheaterCode;
  label: string;
  href: string;
  logoUrl: string;
  logoClassName: string;
}> = [
  {
    code: "cgv",
    label: "CGV에서 예매 확인",
    href: "https://cgv.co.kr/cnm/movieBook/movie",
    logoUrl: "https://img.cgv.co.kr/R2014/images/title/h1_cgv.png",
    logoClassName: "h-4 w-auto",
  },
  {
    code: "megabox",
    label: "메가박스에서 예매 확인",
    href: "https://www.megabox.co.kr/booking",
    logoUrl: "https://img.megabox.co.kr/static/pc/images/common/ci/logo_new2.png",
    logoClassName: "h-5 w-auto",
  },
  {
    code: "lotte",
    label: "롯데시네마에서 예매 확인",
    href: "https://www.lottecinema.co.kr/NLCHS/Ticketing",
    logoUrl: "https://www.lottecinema.co.kr/NLCHS/Content/images/common/logo.png",
    logoClassName: "h-4 w-auto",
  },
] as const;

export function TheaterStatusBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-[11px] font-black text-ink shadow-sm ${className}`}
    >
      <Clapperboard aria-hidden="true" className="size-3.5" />
      극장 상영 중
    </span>
  );
}

export function TheaterBookingLinks({
  className = "",
  theaters = [],
  statuses,
  compact = false,
}: {
  className?: string;
  theaters?: readonly TheaterCode[];
  statuses?: readonly TheaterStatus[];
  compact?: boolean;
}) {
  const stateByCode = new Map(statuses?.map((status) => [status.code, status]));
  const links = THEATER_BOOKING_LINKS.filter((theater) => {
    if (!statuses) return theaters.includes(theater.code);
    return stateByCode.get(theater.code)?.availability !== "unavailable";
  });
  if (!links.length) return null;

  return (
    <section className={className}>
      <h2 className={compact ? "text-sm font-black text-foreground" : "text-lg font-black text-foreground"}>
        극장에서 확인하기
      </h2>
      <nav aria-label="극장 예매처 확인" className={compact ? "mt-2 grid gap-1.5 text-xs" : "mt-4 grid gap-2 text-sm"}>
        {links.map((theater) => (
          <a
            className={`flex items-center gap-3 rounded-xl border border-border bg-white font-bold text-foreground transition-colors hover:border-brand-muted hover:bg-brand-soft ${compact ? "min-h-9 px-3" : "min-h-12 px-4"}`}
            href={theater.href}
            key={theater.code}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className={`grid shrink-0 place-items-center ${compact ? "w-8" : "w-12"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 각 극장사가 제공하는 공식 워드마크입니다. */}
              <img alt="" className={`${theater.logoClassName} max-w-full object-contain`} src={theater.logoUrl} />
            </span>
            <span>{theater.label}</span>
            {stateByCode.get(theater.code)?.availability === "unknown" && (
              <span className="ml-auto text-[10px] font-semibold text-muted-foreground">확인 필요</span>
            )}
          </a>
        ))}
      </nav>
    </section>
  );
}
