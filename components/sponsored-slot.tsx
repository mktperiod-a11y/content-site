import Link from "next/link";

/**
 * 제휴 광고 구좌.
 *
 * 이 파일의 컴포넌트는 **작품 정보를 prop으로 받지 않는다.** 광고가 특정 작품과
 * 이어져 보이면 "이 작품을 저기서 볼 수 있다"는 오해를 만들기 때문에, 문구로
 * 조심하는 대신 구조적으로 결합이 불가능하게 둔다. 문구에도 작품을 가리키는
 * 표현을 넣지 않는다.
 */

const WATCH_OPTIONS_HREF = "/watch-options";
const HEADLINE_TOP = "구독 말고";
const HEADLINE_BOTTOM = "골라 보는 방법은?";
const CTA_LABEL = "확인하러 가기";

/** 오른쪽에서 들어오는 주황 광원 */
const WARM_GRADIENT =
  "radial-gradient(circle, rgba(240,92,30,.82) 0%, rgba(214,68,16,.26) 40%, transparent 68%)";
/** 디스크 오브젝트 */
const DISC_GRADIENT =
  "conic-gradient(from 205deg, #ffd0ad, #f05c1e 26%, #8e3310 50%, #f05c1e 74%, #ffd0ad)";
const TILE_GRADIENT = "linear-gradient(152deg, #fff 0%, #fff 56%, #ffe7d8 100%)";
const CHIP_GRADIENT = "linear-gradient(150deg, #ffb98a, #f05c1e)";

const SURFACE = "#0c0d10";

function SponsoredTag() {
  return (
    <span className="absolute left-3.5 top-3 z-20 rounded border border-white/25 px-1.5 py-0.5 text-[8.5px] font-black tracking-[0.1em] text-white/50 sm:left-4 sm:top-3.5 sm:text-[9.5px]">
      제휴
    </span>
  );
}

function Disc({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute rounded-full shadow-[0_22px_52px_rgba(0,0,0,.5)] ${className}`}
      style={{ backgroundImage: DISC_GRADIENT, ...style }}
    >
      <span
        className="absolute inset-[34%] block rounded-full"
        style={{ background: SURFACE }}
      />
    </span>
  );
}

function Tile({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute grid place-items-center rounded-[25%] shadow-[0_20px_44px_rgba(0,0,0,.55),inset_0_2px_0_#fff] ${className}`}
      style={{ backgroundImage: TILE_GRADIENT, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 제휴사가 제공한 로고입니다. */}
      <img alt="" className="w-[70%]" src="/kdisk-logo.png" />
    </span>
  );
}

function Chip({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute rounded-[28%] shadow-[0_12px_28px_rgba(0,0,0,.45)] ${className}`}
      style={{ backgroundImage: CHIP_GRADIENT, ...style }}
    />
  );
}

function Pill({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative z-10 inline-flex items-center gap-1.5 rounded-full bg-white font-black tracking-[-0.02em] text-[#111] shadow-[0_7px_22px_rgba(0,0,0,.34)] ${className}`}
    >
      {CTA_LABEL}
      <span aria-hidden="true">→</span>
    </span>
  );
}

/**
 * 작품 상세 사이드바용 박스. 제공처 확인 여부와 관계없이 늘 같은 자리에 둔다.
 * 조건부로 띄우면 "제공처가 없어서 권한다"로 읽히기 때문이다.
 */
export function SponsoredBox({ className = "" }: { className?: string }) {
  return (
    <Link
      aria-label={`제휴 광고: ${HEADLINE_TOP} ${HEADLINE_BOTTOM}`}
      className={`relative block aspect-[384/195] overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
      data-ga-event="sponsored_box_click"
      href={WATCH_OPTIONS_HREF}
      style={{ background: SURFACE }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-[22%] right-[-14%] block aspect-square w-[66%] rounded-full"
        style={{ backgroundImage: WARM_GRADIENT }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 block"
        style={{
          backgroundImage: `linear-gradient(95deg, ${SURFACE} 26%, rgba(12,13,16,.5) 52%, transparent 80%)`,
        }}
      />
      <SponsoredTag />

      <Disc className="right-[-9%] top-[18%] aspect-square w-[31%]" />
      <Tile
        className="right-[24%] top-[8%] aspect-square w-[17%] opacity-90"
        style={{ transform: "rotate(-16deg)" }}
      />
      <Tile
        className="bottom-[-8%] right-[7%] aspect-square w-[23%]"
        style={{ transform: "rotate(8deg)" }}
      />

      <span className="absolute left-5 top-1/2 z-10 block -translate-y-1/2">
        <span className="block text-[23px] font-black leading-[1.18] tracking-[-0.05em] text-white [text-shadow:0_0_1px_rgba(255,255,255,.85),0_2px_16px_rgba(0,0,0,.55)]">
          {HEADLINE_TOP}
          <br />
          {HEADLINE_BOTTOM}
        </span>
        <Pill className="mt-3 h-9 px-[17px] text-[12.5px]" />
      </span>
    </Link>
  );
}

/**
 * 가격 비교 결과처럼 가로로 넓은 자리에 쓰는 배너.
 */
export function SponsoredBanner({ className = "" }: { className?: string }) {
  return (
    <Link
      aria-label={`제휴 광고: ${HEADLINE_TOP} ${HEADLINE_BOTTOM}`}
      className={`relative block min-h-[170px] overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:min-h-[210px] ${className}`}
      data-ga-event="sponsored_banner_click"
      href={WATCH_OPTIONS_HREF}
      style={{ background: SURFACE }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-[52%] right-[-10%] block aspect-square w-[52%] rounded-full"
        style={{ backgroundImage: WARM_GRADIENT }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 block"
        style={{
          backgroundImage: `linear-gradient(90deg, ${SURFACE} 20%, rgba(12,13,16,.5) 45%, transparent 70%)`,
        }}
      />
      <SponsoredTag />

      <Disc className="right-[-8%] top-[-28%] aspect-square w-[30%]" />
      <Tile
        className="right-[12%] top-[19%] aspect-square w-[13%]"
        style={{ transform: "rotate(-10deg)" }}
      />
      <Chip
        className="bottom-[14%] right-[27%] aspect-square w-[3.4%]"
        style={{ transform: "rotate(-22deg)" }}
      />
      <Chip
        className="right-[31%] top-[21%] aspect-square w-[2.2%] opacity-85"
        style={{ transform: "rotate(12deg)" }}
      />

      <span className="absolute left-6 top-1/2 z-10 block -translate-y-1/2 sm:left-11">
        <span className="block text-[26px] font-black leading-[1.16] tracking-[-0.05em] text-white [text-shadow:0_0_1px_rgba(255,255,255,.85),0_2px_18px_rgba(0,0,0,.55)] sm:text-[39px]">
          {HEADLINE_TOP}
          <br />
          {HEADLINE_BOTTOM}
        </span>
        <Pill className="mt-3.5 h-10 px-5 text-[13px] sm:mt-[17px] sm:h-[45px] sm:px-6 sm:text-[15px]" />
      </span>
    </Link>
  );
}
