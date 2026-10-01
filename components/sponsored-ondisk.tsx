/**
 * 온디스크 제휴 광고 구좌.
 *
 * sponsored-slot.tsx 와 같은 원칙을 따른다. **작품 정보를 prop으로 받지 않고**,
 * 문구에도 작품을 가리키는 표현을 넣지 않는다. 광고가 특정 작품과 이어져 보이면
 * "이 작품을 저기서 볼 수 있다"는 오해를 만들기 때문이다.
 *
 * 디자인은 KDisk 구좌(어두운 바탕·주황 빛·입체 원반)와 겹치지 않게, 글자가 주인공인
 * 포스터형으로 만들었다. 온디스크 파랑 단색 바탕에 망점을 깔고, 흰 테두리를 두른
 * 스티커 제목, 기울인 뱃지, 흰 로고 라벨, 가장자리에서 들여다보는 웃는 얼굴을 얹는다.
 * 문구는 온디스크가 실제로 다루는 장르만 말하고 이용 가능 여부는 단정하지 않는다.
 */

const ONDISK_URL = "https://new.ondisk.co.kr/";
const BADGE = "영화부터 웹툰까지";
const HEADLINE_TOP = "한곳에서";
const HEADLINE_BOTTOM = "둘러보기";
const CTA_LABEL = "바로가기";
const GENRES = ["영화", "드라마", "애니", "웹툰"] as const;

const INK = "#0f1b2d";
const BLUE = "#1f8be0";
const YELLOW = "#ffd84d";
/** 바탕 망점. 단색 위에 옅게 깔아 인쇄물 같은 질감을 낸다. */
const HALFTONE = `radial-gradient(rgba(255,255,255,.2) 1.15px, transparent 1.6px) 0 0 / 9px 9px, ${BLUE}`;

/** 한쪽 구석에 붙는 "제휴" 표시. */
function SponsoredTag() {
  return (
    <span className="absolute left-3.5 top-3 z-20 rounded border border-white/40 px-1.5 py-0.5 text-[8.5px] font-black tracking-[0.1em] text-white/75 sm:left-4 sm:top-3.5 sm:text-[9.5px]">
      제휴
    </span>
  );
}

/** 로고의 "o" — 웃는 얼굴과 새싹. 가장자리에 걸쳐 둔다. */
function Smiley({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className={`absolute drop-shadow-[0_10px_18px_rgba(10,40,80,.3)] ${className}`}
      style={style}
      viewBox="0 0 100 104"
    >
      <path d="M50 22V10" stroke={INK} strokeLinecap="round" strokeWidth="4" />
      <path d="M50 14C41 3 29 6 31 15c6 3 14 3 19-1Z" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
      <path d="M50 14c9-11 21-8 19 1-6 3-14 3-19-1Z" fill="#7ee0c3" stroke={INK} strokeWidth="2.5" />
      <circle cx="50" cy="60" fill="#fff" r="38" stroke={INK} strokeWidth="7" />
      <circle cx="37" cy="54" fill={INK} r="4.6" />
      <circle cx="63" cy="54" fill={INK} r="4.6" />
      <path d="M34 68q16 14 32 0" fill="none" stroke={INK} strokeLinecap="round" strokeWidth="6" />
    </svg>
  );
}

/** 네 갈래 반짝이 */
function Sparkle({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={`absolute ${className}`} viewBox="0 0 24 24">
      <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12C7 11 11 7 12 0Z" fill="#fff" />
    </svg>
  );
}

/** 기울인 뱃지. 흰 테두리를 둘러 스티커처럼 보이게 한다. */
function Badge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block -rotate-[5deg] rounded-full border-2 border-white font-black tracking-[-0.03em] shadow-[0_3px_0_rgba(15,27,45,.35)] ${className}`}
      style={{ background: YELLOW, color: INK }}
    >
      {BADGE}
    </span>
  );
}

/**
 * 스티커 제목. 흰 획을 두른 글자를 뒤에 깔고 같은 글자를 위에 겹쳐,
 * 브라우저마다 다른 획 처리와 상관없이 테두리가 글자 밖으로만 보이게 한다.
 */
function StickerHeadline({ className = "", stroke }: { className?: string; stroke: number }) {
  const lines = (
    <>
      <span style={{ color: YELLOW }}>한곳</span>
      {HEADLINE_TOP.slice(2)}
      <br />
      {HEADLINE_BOTTOM}
    </>
  );
  return (
    <span className={`relative block font-black leading-[1.08] tracking-[-0.04em] ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-0 block text-white [text-shadow:0_5px_0_rgba(15,27,45,.35)]"
        style={{ WebkitTextStroke: `${stroke}px #fff` }}
      >
        {HEADLINE_TOP}
        <br />
        {HEADLINE_BOTTOM}
      </span>
      <span className="relative block" style={{ color: INK }}>
        {lines}
      </span>
    </span>
  );
}

/** 흰 로고 라벨 + 바로가기 */
function CtaRow({ logoClassName, textClassName }: { logoClassName: string; textClassName: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-lg bg-white shadow-[0_3px_0_rgba(15,27,45,.35)] ${logoClassName}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 제휴사 로고입니다. */}
        <img alt="온디스크" className="h-[62%] w-auto" src="/ondisk-logo.png" />
      </span>
      <span className={`font-black tracking-[-0.03em] text-white ${textClassName}`}>
        {CTA_LABEL} <span aria-hidden="true">↗</span>
      </span>
    </span>
  );
}

const linkProps = {
  href: ONDISK_URL,
  rel: "sponsored noopener noreferrer",
  target: "_blank",
  "aria-label": `제휴 광고: 온디스크 — ${BADGE} ${HEADLINE_TOP} ${HEADLINE_BOTTOM} (새 창)`,
} as const;

/** 작품 상세 사이드바용 박스. KDisk 박스와 같은 크기다. */
export function OnDiskBox({ className = "" }: { className?: string }) {
  return (
    <a
      {...linkProps}
      className={`relative block aspect-[384/195] overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
      data-ga-event="sponsored_ondisk_box_click"
      style={{ background: HALFTONE }}
    >
      <SponsoredTag />
      <Sparkle className="right-[9%] top-[11%] w-[6%]" />
      <Sparkle className="left-[9%] bottom-[16%] w-[4%] opacity-80" />
      <Smiley className="bottom-[-20%] right-[-5%] w-[25%]" style={{ transform: "rotate(-14deg)" }} />

      <span className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
        <Badge className="px-2.5 py-[3px] text-[10.5px]" />
        <StickerHeadline className="mt-1.5 text-[34px]" stroke={7} />
        <span className="mt-2.5">
          <CtaRow logoClassName="h-[26px] px-2" textClassName="text-[12.5px]" />
        </span>
      </span>
    </a>
  );
}

/** 가격 비교 결과처럼 가로로 넓은 자리에 쓰는 배너. KDisk 배너와 같은 높이다. */
export function OnDiskBanner({ className = "" }: { className?: string }) {
  return (
    <a
      {...linkProps}
      className={`relative block min-h-[170px] overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:min-h-[210px] ${className}`}
      data-ga-event="sponsored_ondisk_banner_click"
      style={{ background: HALFTONE }}
    >
      <SponsoredTag />
      <Sparkle className="right-[8%] top-[12%] w-4 sm:right-[30%] sm:top-[14%] sm:w-6" />
      <Sparkle className="bottom-[14%] left-[7%] w-3 opacity-80 sm:left-[24%] sm:w-4" />
      <Smiley
        className="bottom-[-24%] right-[-5%] w-[24%] sm:bottom-[-30%] sm:right-[3%] sm:w-[17%]"
        style={{ transform: "rotate(-14deg)" }}
      />

      {/* 넓은 화면에서만, 다루는 장르를 스티커처럼 양옆에 붙인다. */}
      <span aria-hidden="true" className="absolute inset-0 hidden sm:block">
        {GENRES.map((genre, index) => (
          <span
            className="absolute rounded-full border-2 border-white bg-white/15 px-3 py-1 text-[13px] font-black text-white"
            key={genre}
            style={{
              left: `${[7, 15, 70, 63][index]}%`,
              top: `${[22, 60, 24, 64][index]}%`,
              transform: `rotate(${[-8, 6, 7, -6][index]}deg)`,
            }}
          >
            {genre}
          </span>
        ))}
      </span>

      <span className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
        <Badge className="px-3 py-1 text-[11.5px] sm:px-3.5 sm:text-[13px]" />
        <StickerHeadline className="mt-1.5 text-[34px] sm:mt-2 sm:text-[50px]" stroke={8} />
        <span className="mt-2.5 sm:mt-3">
          <CtaRow
            logoClassName="h-[28px] px-2 sm:h-[34px] sm:px-2.5"
            textClassName="text-[13px] sm:text-[15px]"
          />
        </span>
      </span>
    </a>
  );
}
