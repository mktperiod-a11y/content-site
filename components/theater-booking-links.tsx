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
    logoClassName: "w-10",
  },
  {
    code: "megabox",
    label: "메가박스에서 예매 확인",
    href: "https://www.megabox.co.kr/booking",
    logoUrl: "https://img.megabox.co.kr/static/pc/images/common/ci/logo_new2.png",
    logoClassName: "w-14",
  },
  {
    code: "lotte",
    label: "롯데시네마에서 예매 확인",
    href: "https://www.lottecinema.co.kr/NLCHS/Ticketing",
    logoUrl: "https://www.lottecinema.co.kr/NLCHS/Content/images/common/logo.png",
    logoClassName: "w-[4.5rem]",
  },
] as const;

const THEATER_CHAIN_BADGES: ReadonlyArray<{
  code: TheaterCode;
  label: string;
  className: string;
}> = [
  {
    code: "cgv",
    label: "CGV",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  {
    code: "megabox",
    label: "메가박스",
    className: "bg-violet-50 text-violet-800 ring-violet-200",
  },
  {
    code: "lotte",
    label: "롯데시네마",
    className: "bg-rose-50 text-rose-800 ring-rose-200",
  },
];

export function TheaterChainBadges({
  className = "",
  theaters,
}: {
  className?: string;
  theaters: readonly TheaterCode[];
}) {
  const visible = THEATER_CHAIN_BADGES.filter((theater) => theaters.includes(theater.code));
  if (!visible.length) return null;

  return (
    <div
      aria-label={`현재 상영 극장: ${visible.map((theater) => theater.label).join(", ")}`}
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {visible.map((theater) => (
        <span
          aria-hidden="true"
          className={`inline-flex h-6 items-center rounded-full px-2 text-[10px] font-black ring-1 ring-inset ${theater.className}`}
          key={theater.code}
        >
          {theater.label}
        </span>
      ))}
    </div>
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
            <span className={`grid shrink-0 place-items-center ${compact ? "h-5 w-16" : "h-6 w-20"}`}>
              {theater.code === "cgv" ? (
                <span
                  aria-hidden="true"
                  className="text-[1.05rem] font-black italic leading-none tracking-[-0.08em] text-[#e31b35]"
                >
                  CGV
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- 각 극장사가 제공하는 공식 워드마크입니다.
                <img alt="" className={`${theater.logoClassName} max-h-full max-w-full object-contain`} src={theater.logoUrl} />
              )}
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
