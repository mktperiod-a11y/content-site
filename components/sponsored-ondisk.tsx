/**
 * 온디스크 제휴 광고 구좌.
 *
 * sponsored-slot.tsx 와 같은 원칙을 따른다. **작품 정보를 prop으로 받지 않고**,
 * 문구에도 작품을 가리키는 표현을 넣지 않는다. 광고가 특정 작품과 이어져 보이면
 * "이 작품을 저기서 볼 수 있다"는 오해를 만들기 때문이다.
 *
 * 디자인은 KDisk 구좌(어두운 바탕·주황 빛·입체 원반)와 겹치지 않게, 은은한 하늘색
 * 바탕에 왼쪽 정렬 문구와 오른쪽 포인트 그림(팝콘·클래퍼보드·티켓·웃는 얼굴 동전)을
 * 둔 단정한 구성이다. 문구는 온디스크가 다루는 장르만 말하고 이용 가능 여부는
 * 단정하지 않는다.
 */

const ONDISK_URL = "https://new.ondisk.co.kr/";
const HEADLINE_TOP = "주말 정주행 고민이면";
const HEADLINE_BOTTOM = "영화부터 웹툰까지";
const CTA_LABEL = "온디스크에서 둘러보기";

const INK = "#18212f";
const ACCENT = "#2f6bd8";
const BACKGROUND =
  "radial-gradient(70% 90% at 85% 100%, rgba(205,232,255,.9) 0%, transparent 70%), linear-gradient(165deg, #f4f8fe 0%, #e6effb 60%, #dce8f8 100%)";

/** 로고 옆에 붙는 "제휴" 표시 */
function SponsoredTag() {
  return (
    <span className="rounded border border-[#18212f]/20 px-1.5 py-px text-[9px] font-extrabold tracking-[0.08em] text-[#18212f]/50 sm:text-[10px]">
      제휴
    </span>
  );
}

function BrandRow({ logoClassName }: { logoClassName: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- 제휴사 로고입니다. */}
      <img alt="온디스크" className={`w-auto ${logoClassName}`} src="/ondisk-logo.png" />
      <SponsoredTag />
    </span>
  );
}

const SPARKLE = "M6 0c.5 3.5 2.5 5.5 6 6-3.5.5-5.5 2.5-6 6-.5-3.5-2.5-5.5-6-6 3.5-.5 5.5-2.5 6-6Z";
const CLAPPER_STRIPES = (y: number) =>
  `M6 ${y}h10l-8 12H-2ZM26 ${y}h10l-8 12H18ZM46 ${y}h10l-8 12H38ZM66 ${y}h10l-8 12H58Z`;

/**
 * 오른쪽 포인트 그림. 그라데이션 id가 페이지 안에서 겹치지 않게 구좌마다 다른 접두어를 쓴다.
 */
function Art({ id, className }: { id: string; className: string }) {
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <svg aria-hidden="true" className={`absolute ${className}`} overflow="visible" viewBox="-4 -16 212 160">
      <defs>
        <linearGradient id={`${id}-navy`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#45556f" />
          <stop offset="1" stopColor="#1d2738" />
        </linearGradient>
        <radialGradient cx=".35" cy=".3" id={`${id}-coin`} r=".8">
          <stop offset="0" stopColor="#a9cdff" />
          <stop offset=".55" stopColor="#5b93f0" />
          <stop offset="1" stopColor="#3a6fd4" />
        </radialGradient>
        <linearGradient id={`${id}-tix`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe7a3" />
          <stop offset="1" stopColor="#f7c75a" />
        </linearGradient>
        <linearGradient id={`${id}-cup`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#e9eef6" />
        </linearGradient>
        <filter height="200%" id={`${id}-soft`} width="200%" x="-50%" y="-50%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <clipPath id={`${id}-band`}>
          <rect height="12" rx="4" width="78" x="0" y="24" />
        </clipPath>
        <clipPath id={`${id}-cupclip`}>
          <path d="M0 0H40L35 50H5Z" />
        </clipPath>
      </defs>

      {/* 바닥 그림자 */}
      <ellipse cx="108" cy="128" fill="#6d8fc4" filter={ref("soft")} opacity=".22" rx="70" ry="7" />

      {/* 티켓 */}
      <g transform="translate(144 6) rotate(14)">
        <rect fill="#b58a2a" filter={ref("soft")} height="30" opacity=".25" rx="5" width="56" x="2" y="4" />
        <path
          d="M5 0H51a5 5 0 0 0 5 5V10a4 4 0 0 0 0 8V25a5 5 0 0 0-5 5H5a5 5 0 0 0-5-5V18a4 4 0 0 0 0-8V5A5 5 0 0 0 5 0Z"
          fill={ref("tix")}
        />
        <path d="M40 4V26" stroke="#d9a53a" strokeDasharray="2.5 2.5" strokeWidth="1.2" />
        <text fill="#8a5d10" fontSize="8.5" fontWeight="900" letterSpacing=".5" textAnchor="middle" x="20" y="19">
          MOVIE
        </text>
        <circle cx="48" cy="15" fill="#e8b445" r="3" />
      </g>

      {/* 클래퍼보드 */}
      <g transform="translate(70 40) rotate(-7)">
        <rect fill="#1d2738" filter={ref("soft")} height="54" opacity=".25" rx="9" width="76" x="2" y="30" />
        <rect fill={ref("navy")} height="56" rx="9" width="78" x="0" y="24" />
        <g clipPath={ref("band")}>
          <rect fill="#e9eef6" height="12" rx="4" width="78" x="0" y="24" />
          <path d={CLAPPER_STRIPES(24)} fill="#2a3448" />
        </g>
        <g transform="rotate(-16 2 22)">
          <rect fill="#e9eef6" height="12" rx="4" width="78" x="0" y="9" />
          <path d={CLAPPER_STRIPES(9)} fill="#2a3448" />
        </g>
        <circle cx="3" cy="22" fill="#c9d3e3" r="3.2" />
        <rect fill="#fff" height="4" opacity=".35" rx="2" width="34" x="10" y="46" />
        <rect fill="#fff" height="4" opacity=".2" rx="2" width="52" x="10" y="56" />
        <rect fill="#fff" height="4" opacity=".2" rx="2" width="24" x="10" y="66" />
      </g>

      {/* 팝콘 */}
      <g transform="translate(40 68)">
        <ellipse cx="20" cy="57" fill="#6d8fc4" filter={ref("soft")} opacity=".3" rx="20" ry="4" />
        <g fill="#fff6e2" stroke="#f0d9a8" strokeWidth="1.2">
          <circle cx="8" cy="0" r="7" />
          <circle cx="19" cy="-5" r="8" />
          <circle cx="31" cy="-1" r="7" />
          <circle cx="14" cy="4" r="6" />
          <circle cx="26" cy="5" r="6" />
        </g>
        <path d="M0 0H40L35 50H5Z" fill={ref("cup")} />
        <path clipPath={ref("cupclip")} d="M3 0h7l1 50H6ZM17 0h6l0 50h-6ZM30 0h7l-3 50h-5Z" fill="#f07a7a" />
        <rect fill="#f07a7a" height="6" rx="3" width="44" x="-2" y="-1" />
        <rect fill="#fff" height="2" opacity=".45" rx="1" width="40" x="0" y="0" />
      </g>

      {/* 웃는 얼굴 동전 — 로고의 "o" */}
      <g transform="translate(160 98)">
        <circle cx="0" cy="4" fill="#2c58b0" r="20" />
        <circle fill={ref("coin")} r="20" />
        <circle fill="none" opacity=".55" r="15.5" stroke="#fff" strokeWidth="1.4" />
        <circle cx="-5.5" cy="-3" fill="#fff" r="2.2" />
        <circle cx="5.5" cy="-3" fill="#fff" r="2.2" />
        <path d="M-7 4q7 7 14 0" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2.6" />
        <path d="M-12 -12a17 17 0 0 1 9-5" fill="none" opacity=".7" stroke="#fff" strokeLinecap="round" strokeWidth="2.2" />
      </g>

      <path d={SPARKLE} fill="#fff" transform="translate(30 30)" />
      <path d={SPARKLE} fill="#fff" transform="translate(186 60) scale(.7)" />
    </svg>
  );
}

function Copy({ headlineClassName, ctaClassName }: { headlineClassName: string; ctaClassName: string }) {
  return (
    <>
      <span className={`block font-extrabold leading-[1.28] tracking-[-0.035em] ${headlineClassName}`} style={{ color: INK }}>
        {HEADLINE_TOP}
        <br />
        <span style={{ color: ACCENT }}>{HEADLINE_BOTTOM}</span>
      </span>
      <span className={`flex items-center gap-0.5 font-semibold tracking-[-0.02em] text-[#3d4a5c] ${ctaClassName}`}>
        {CTA_LABEL}
        <span aria-hidden="true" className="font-black">
          ›
        </span>
      </span>
    </>
  );
}

const linkProps = {
  href: ONDISK_URL,
  rel: "sponsored noopener noreferrer",
  target: "_blank",
  "aria-label": `제휴 광고: 온디스크 — ${HEADLINE_TOP} ${HEADLINE_BOTTOM}, ${CTA_LABEL} (새 창)`,
} as const;

const SURFACE_CLASS =
  "relative block overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(24,33,47,.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/** 작품 상세 사이드바용 박스. KDisk 박스와 같은 크기다. */
export function OnDiskBox({ className = "" }: { className?: string }) {
  return (
    <a
      {...linkProps}
      className={`${SURFACE_CLASS} aspect-[384/195] ${className}`}
      data-ga-event="sponsored_ondisk_box_click"
      style={{ background: BACKGROUND }}
    >
      <Art className="bottom-0 right-[-2px] w-[50%]" id="ondisk-box" />
      <span className="absolute left-5 top-1/2 z-10 block -translate-y-1/2">
        <BrandRow logoClassName="h-[22px]" />
        <Copy ctaClassName="mt-2 text-[12px]" headlineClassName="mt-2.5 text-[19px]" />
      </span>
    </a>
  );
}

/** 가격 비교 결과처럼 가로로 넓은 자리에 쓰는 배너. KDisk 배너와 같은 높이다. */
export function OnDiskBanner({ className = "" }: { className?: string }) {
  return (
    <a
      {...linkProps}
      className={`${SURFACE_CLASS} min-h-[170px] sm:min-h-[210px] ${className}`}
      data-ga-event="sponsored_ondisk_banner_click"
      style={{ background: BACKGROUND }}
    >
      <Art className="bottom-0 right-[-4px] w-[48%] sm:bottom-1.5 sm:right-[6%] sm:w-[280px]" id="ondisk-banner" />
      <span className="absolute left-5 top-1/2 z-10 block -translate-y-1/2 sm:left-11">
        <BrandRow logoClassName="h-6 sm:h-7" />
        <Copy
          ctaClassName="mt-2 text-[12.5px] sm:mt-3 sm:text-[15px]"
          headlineClassName="mt-2.5 text-[20px] sm:mt-3.5 sm:text-[30px]"
        />
      </span>
    </a>
  );
}
