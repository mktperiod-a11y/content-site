import { partnerHref } from "@/lib/partner-links";

/**
 * 제휴 광고 구좌.
 *
 * 이 파일의 컴포넌트는 **작품 정보를 prop으로 받지 않는다.** 광고가 특정 작품과
 * 이어져 보이면 "이 작품을 저기서 볼 수 있다"는 오해를 만들기 때문에, 문구로
 * 조심하는 대신 구조적으로 결합이 불가능하게 둔다. 문구에도 작품을 가리키는
 * 표현을 넣지 않는다.
 */

/** 우리 주소 /go/kdisk 를 거쳐 KDisk 파트너 링크로 넘어간다 (lib/partner-links.ts). */
const linkProps = {
  href: partnerHref("kdisk"),
  rel: "sponsored noopener noreferrer",
  target: "_blank",
} as const;

const HEADLINE_TOP = "늘어만 가는";
const HEADLINE_BOTTOM = "구독제가 지겹다면?";
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
    <a
      {...linkProps}
      aria-label={`제휴 광고: ${HEADLINE_TOP} ${HEADLINE_BOTTOM} (새 창)`}
      className={`relative block @container aspect-[384/195] overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-[300px]:hidden ${className}`}
      data-ga-event="sponsored_box_click"
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

      {/* 글자·버튼은 박스 폭(cqw)에 비례한다. PC 사이드바(408px)에서 제목 23px 이고, 폰에서는
          같은 비율로 작아져 박스보다 글자가 커 보이지 않는다(넓은 태블릿 폭에서는 상한을 둔다).
          폰(420px 이하)에서는 글 묶음을 조금 내려 "제휴" 표시와 띄우고, 300px 미만에서는 박스를 숨긴다. */}
      <span className="absolute left-[min(4.9cqw,28px)] top-1/2 z-10 block -translate-y-1/2 max-[421px]:top-[56%]">
        <span className="block text-[min(5.64cqw,30px)] font-black leading-[1.18] tracking-[-0.05em] text-white [text-shadow:0_0_1px_rgba(255,255,255,.85),0_2px_16px_rgba(0,0,0,.55)]">
          {HEADLINE_TOP}
          <br />
          {HEADLINE_BOTTOM}
        </span>
        <Pill className="mt-[min(2.94cqw,15px)] h-[min(8.82cqw,46px)] px-[min(4.17cqw,22px)] text-[min(3.06cqw,16px)]" />
      </span>
    </a>
  );
}

/**
 * 가격 비교 결과처럼 가로로 넓은 자리에 쓰는 배너.
 */
export function SponsoredBanner({ className = "" }: { className?: string }) {
  return (
    <a
      {...linkProps}
      aria-label={`제휴 광고: ${HEADLINE_TOP} ${HEADLINE_BOTTOM} (새 창)`}
      className={`relative block @container min-h-[170px] overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-[300px]:hidden sm:min-h-[210px] ${className}`}
      data-ga-event="sponsored_banner_click"
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
        className="right-[10%] top-[16%] aspect-square w-[23%] sm:right-[12%] sm:top-[19%] sm:w-[13%]"
        style={{ transform: "rotate(-10deg)" }}
      />
      <Chip
        className="bottom-[12%] right-[30%] aspect-square w-[6%] sm:bottom-[14%] sm:right-[27%] sm:w-[3.4%]"
        style={{ transform: "rotate(-22deg)" }}
      />
      <Chip
        className="right-[36%] top-[18%] aspect-square w-[4%] opacity-85 sm:right-[31%] sm:top-[21%] sm:w-[2.2%]"
        style={{ transform: "rotate(12deg)" }}
      />

      {/* 가격 비교 결과 칸처럼 PC에서도 배너가 좁아지면(640px 미만) 제목을 줄이고 왼쪽 여백을
          좁혀 로고 타일을 덮지 않게 한다. 글 묶음은 조금 내려 "제휴" 표시와 띄운다.
          폰(420px 이하)에서는 조금 더 내리고, 350px 이하에서는 글자·버튼을 줄이며, 300px 미만에서는 숨긴다. */}
      <span className="absolute left-6 top-[55%] z-10 block -translate-y-1/2 max-[421px]:top-[57%] sm:left-11 sm:@max-[640px]:left-6">
        <span className="block text-[26px] max-[351px]:text-[22px] font-black leading-[1.16] tracking-[-0.05em] text-white [text-shadow:0_0_1px_rgba(255,255,255,.85),0_2px_18px_rgba(0,0,0,.55)] sm:text-[39px] sm:@max-[640px]:text-[28px]">
          {/* 좁은 폰에서는 "구독제가 지겹다면?" 한 줄이 오른쪽 로고 타일을 덮는다.
              모바일에서만 이 줄을 두 줄로 나눠 쓰고, 크기·위치는 원래대로 둔다. */}
          <span className="sm:hidden">
            {HEADLINE_BOTTOM.split(" ")[0]}
            <br />
            {HEADLINE_BOTTOM.split(" ").slice(1).join(" ")}
          </span>
          <span className="hidden sm:inline">
            {HEADLINE_TOP}
            <br />
            {HEADLINE_BOTTOM}
          </span>
        </span>
        <Pill className="mt-3.5 h-10 px-5 text-[13px] max-[351px]:mt-3 max-[351px]:h-9 max-[351px]:px-4 max-[351px]:text-[12px] sm:mt-[17px] sm:h-[45px] sm:px-6 sm:text-[15px]" />
      </span>
    </a>
  );
}
