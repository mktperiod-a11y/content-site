/**
 * 온디스크 제휴 광고 구좌.
 *
 * sponsored-slot.tsx 와 같은 원칙을 따른다. **작품 정보를 prop으로 받지 않고**,
 * 문구에도 작품을 가리키는 표현을 넣지 않는다. 광고가 특정 작품과 이어져 보이면
 * "이 작품을 저기서 볼 수 있다"는 오해를 만들기 때문이다.
 *
 * 디자인은 KDisk 구좌(어두운 바탕·주황 빛·입체 원반)와 겹치지 않게, 온디스크 로고의
 * 웃는 얼굴과 새싹을 키운 밝은 하늘색 화면으로 만들었다. 문구는 온디스크가 실제로
 * 다루는 장르(영화·드라마·예능·애니·웹툰)만 말하고 이용 가능 여부는 단정하지 않는다.
 */

const ONDISK_URL = "https://new.ondisk.co.kr/";
const HEADLINE_TOP = "영화부터 웹툰까지";
const HEADLINE_BOTTOM = "한곳에서 둘러보기";
const CTA_LABEL = "온디스크 둘러보기";
const GENRES = ["영화", "드라마", "애니", "웹툰"] as const;

const INK = "#0f1b2d";
const SKY = "#3aa6e8";
const BACKGROUND = "linear-gradient(140deg, #f3faff 0%, #dcf0ff 52%, #d3f3e9 100%)";

/** 로고 옆에 붙는 "제휴" 표시. 로고와 한 줄에 둬 다른 요소와 겹치지 않게 한다. */
function SponsoredTag() {
  return (
    <span className="rounded border border-[#0f1b2d]/20 px-1.5 py-0.5 text-[8.5px] font-black tracking-[0.1em] text-[#0f1b2d]/45 sm:text-[9.5px]">
      제휴
    </span>
  );
}

function BrandRow({ logoClassName }: { logoClassName: string }) {
  return (
    <span className="flex items-center gap-2">
      <Logo className={logoClassName} />
      <SponsoredTag />
    </span>
  );
}

/** 로고의 "o" — 웃는 얼굴과 새싹. 화면 오른쪽에 크게 걸쳐 둔다. */
function Smiley({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className={`absolute drop-shadow-[0_18px_30px_rgba(31,98,150,.22)] ${className}`}
      style={style}
      viewBox="0 0 100 104"
    >
      <path d="M50 22V10" stroke={INK} strokeLinecap="round" strokeWidth="4" />
      <path d="M50 14C41 3 29 6 31 15c6 3 14 3 19-1Z" fill={SKY} />
      <path d="M50 14c9-11 21-8 19 1-6 3-14 3-19-1Z" fill="#1f86c9" />
      <circle cx="50" cy="60" fill="#fff" r="38" stroke={INK} strokeWidth="7" />
      <circle cx="37" cy="54" fill={INK} r="4.6" />
      <circle cx="63" cy="54" fill={INK} r="4.6" />
      <path d="M34 68q16 14 32 0" fill="none" stroke={INK} strokeLinecap="round" strokeWidth="6" />
    </svg>
  );
}

function Bubble({ className, color }: { className: string; color: string }) {
  return (
    <span aria-hidden="true" className={`absolute block rounded-full ${className}`} style={{ background: color }} />
  );
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-white px-3 shadow-[0_6px_18px_rgba(31,98,150,.14)] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 제휴사 로고입니다. */}
      <img alt="온디스크" className="h-[62%] w-auto" src="/ondisk-logo.png" />
    </span>
  );
}

function Cta({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative z-10 inline-flex items-center gap-1.5 rounded-full font-black tracking-[-0.02em] text-white shadow-[0_8px_20px_rgba(15,27,45,.25)] ${className}`}
      style={{ background: INK }}
    >
      {CTA_LABEL}
      <span aria-hidden="true">↗</span>
    </span>
  );
}

const linkProps = {
  href: ONDISK_URL,
  rel: "sponsored noopener noreferrer",
  target: "_blank",
  "aria-label": `제휴 광고: 온디스크 — ${HEADLINE_TOP} ${HEADLINE_BOTTOM} (새 창)`,
} as const;

/** 작품 상세 사이드바용 박스. KDisk 박스와 같은 크기다. */
export function OnDiskBox({ className = "" }: { className?: string }) {
  return (
    <a
      {...linkProps}
      className={`relative block aspect-[384/195] overflow-hidden rounded-2xl ring-1 ring-[#0f1b2d]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
      data-ga-event="sponsored_ondisk_box_click"
      style={{ background: BACKGROUND }}
    >
      <Bubble className="right-[36%] top-[14%] size-[7%] opacity-70" color="#9bd6fb" />
      <Bubble className="bottom-[16%] right-[40%] size-[4%]" color="#ffd84d" />
      <Bubble className="right-[6%] top-[8%] size-[5%] opacity-80" color="#7ee0c3" />
      <Smiley className="bottom-[-12%] right-[-6%] w-[42%]" style={{ transform: "rotate(-8deg)" }} />

      <span className="absolute left-5 top-1/2 z-10 block -translate-y-1/2">
        <BrandRow logoClassName="h-[26px]" />
        <span className="mt-2 block text-[19px] font-black leading-[1.2] tracking-[-0.05em]" style={{ color: INK }}>
          {HEADLINE_TOP}
          <br />
          {HEADLINE_BOTTOM}
        </span>
        <Cta className="mt-2.5 h-[30px] px-3.5 text-[12px]" />
      </span>
    </a>
  );
}

/** 가격 비교 결과처럼 가로로 넓은 자리에 쓰는 배너. KDisk 배너와 같은 높이다. */
export function OnDiskBanner({ className = "" }: { className?: string }) {
  return (
    <a
      {...linkProps}
      className={`relative block min-h-[170px] overflow-hidden rounded-2xl ring-1 ring-[#0f1b2d]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:min-h-[210px] ${className}`}
      data-ga-event="sponsored_ondisk_banner_click"
      style={{ background: BACKGROUND }}
    >
      <Bubble className="right-[30%] top-[16%] size-4 opacity-70 sm:size-6" color="#9bd6fb" />
      <Bubble className="bottom-[18%] right-[34%] size-2.5 sm:size-3.5" color="#ffd84d" />
      <Bubble className="right-[4%] top-[10%] size-3 opacity-80 sm:size-5" color="#7ee0c3" />
      <Smiley
        className="bottom-[-30%] right-[-8%] w-[46%] sm:bottom-[-34%] sm:right-[2%] sm:w-[26%]"
        style={{ transform: "rotate(-8deg)" }}
      />

      {/* 넓은 화면에서만, 얼굴 둘레에 다루는 장르를 띄운다. */}
      <span aria-hidden="true" className="absolute inset-y-0 right-[26%] hidden w-[22%] sm:block">
        {GENRES.map((genre, index) => (
          <span
            className="absolute rounded-full bg-white px-3 py-1 text-[12px] font-black shadow-[0_6px_16px_rgba(31,98,150,.14)]"
            key={genre}
            style={{
              color: INK,
              left: `${[8, 58, 18, 66][index]}%`,
              top: `${[18, 30, 62, 70][index]}%`,
              transform: `rotate(${[-6, 5, 4, -5][index]}deg)`,
            }}
          >
            {genre}
          </span>
        ))}
      </span>

      <span className="absolute left-6 top-1/2 z-10 block -translate-y-1/2 sm:left-11">
        <BrandRow logoClassName="h-8 sm:h-9" />
        <span
          className="mt-2.5 block text-[24px] font-black leading-[1.16] tracking-[-0.05em] sm:mt-3 sm:text-[34px]"
          style={{ color: INK }}
        >
          {HEADLINE_TOP}
          <br />
          {HEADLINE_BOTTOM}
        </span>
        <Cta className="mt-3 h-10 px-5 text-[13px] sm:mt-3.5 sm:h-[42px] sm:px-6 sm:text-[15px]" />
      </span>
    </a>
  );
}
