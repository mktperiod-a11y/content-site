/**
 * 온디스크 제휴 광고 구좌.
 *
 * sponsored-slot.tsx 와 같은 원칙을 따른다. **작품 정보를 prop으로 받지 않고**,
 * 문구에도 작품을 가리키는 표현을 넣지 않는다. 광고가 특정 작품과 이어져 보이면
 * "이 작품을 저기서 볼 수 있다"는 오해를 만들기 때문이다.
 *
 * 디자인은 KDisk 구좌(어두운 바탕·주황 빛·입체 원반)와 겹치지 않게, 은은한 하늘색
 * 바탕에 왼쪽 정렬 문구와 오른쪽 포인트 그림(public/ondisk-art.svg)을 둔 단정한
 * 구성이다. 문구는 온디스크가 다루는 장르만 말하고 이용 가능 여부는 단정하지 않는다.
 */

import { partnerHref } from "@/lib/partner-links";

const HEADLINE_TOP = "주말 정주행 고민이면";
const HEADLINE_BOTTOM = "영화부터 웹툰까지";
const CTA_LABEL = "온디스크에서 둘러보기";

const BACKGROUND =
  "radial-gradient(70% 90% at 85% 100%, rgba(205,232,255,.9) 0%, transparent 70%), linear-gradient(165deg, #f4f8fe 0%, #e6effb 60%, #dce8f8 100%)";

const linkProps = {
  href: partnerHref("ondisk"),
  rel: "sponsored noopener noreferrer",
  target: "_blank",
  "aria-label": `제휴 광고: 온디스크 — ${HEADLINE_TOP} ${HEADLINE_BOTTOM}, ${CTA_LABEL} (새 창)`,
} as const;

const SURFACE_CLASS =
  "relative block overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(24,33,47,.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Layout = { brand: string; logo: string; tag: string; text: string; headline: string; cta: string };

/** 왼쪽 위 로고 · 제휴 표시와, 그 아래 가운데 높이에 두는 두 줄 제목 · 안내 문구 */
function Copy({ layout }: { layout: Layout }) {
  return (
    <>
      <span className={`absolute z-10 flex items-center gap-1.5 ${layout.brand}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 제휴사 로고입니다. */}
        <img alt="온디스크" className={`w-auto ${layout.logo}`} src="/ondisk-logo.png" />
        <span
          className={`rounded border border-[#18212f]/20 px-1.5 py-px font-extrabold tracking-[0.08em] text-[#18212f]/50 ${layout.tag}`}
        >
          제휴
        </span>
      </span>
      <span className={`absolute z-10 block -translate-y-1/2 ${layout.text}`}>
        <span className={`block font-extrabold leading-[1.28] tracking-[-0.035em] text-[#18212f] ${layout.headline}`}>
          {HEADLINE_TOP}
          <br />
          <span className="text-[#2f6bd8]">{HEADLINE_BOTTOM}</span>
        </span>
        <span className={`flex items-center gap-0.5 font-semibold tracking-[-0.02em] text-[#3d4a5c] ${layout.cta}`}>
          {CTA_LABEL}
          <span aria-hidden="true" className="font-black">
            ›
          </span>
        </span>
      </span>
    </>
  );
}

/** 오른쪽 포인트 그림. 장식이므로 읽지 않게 둔다. */
function Art({ className }: { className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- 정적 장식 그림입니다.
  return <img alt="" aria-hidden="true" className={`absolute h-auto ${className}`} src="/ondisk-art.svg" />;
}

/** 작품 상세 사이드바용 박스. KDisk 박스와 같은 크기다. */
export function OnDiskBox({ className = "" }: { className?: string }) {
  return (
    <a
      {...linkProps}
      className={`${SURFACE_CLASS} @container aspect-[384/195] ${className}`}
      data-ga-event="sponsored_ondisk_box_click"
      style={{ background: BACKGROUND }}
    >
      <Art className="bottom-0 right-[-2px] w-[50%]" />
      {/* 사이드바 폭이 화면마다 달라, 글자와 여백을 박스 폭(cqw)에 맞춰 키운다. */}
      <Copy
        layout={{
          brand: "left-[5.5cqw] top-[5cqw]",
          logo: "h-[6cqw]",
          tag: "text-[2.6cqw]",
          text: "left-[5.5cqw] top-[57%]",
          headline: "text-[6.6cqw]",
          cta: "mt-[2.4cqw] text-[3.9cqw]",
        }}
      />
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
      <Art className="bottom-0 right-[-4px] w-[48%] sm:bottom-1.5 sm:right-[6%] sm:w-[280px]" />
      <Copy
        layout={{
          brand: "left-5 top-4 sm:left-11 sm:top-5",
          logo: "h-6 sm:h-7",
          tag: "text-[9px] sm:text-[10px]",
          text: "left-5 top-[57%] sm:left-11 sm:top-[58%]",
          headline: "text-[23px] sm:text-[34px]",
          cta: "mt-2 text-[14px] sm:mt-3 sm:text-[17px]",
        }}
      />
    </a>
  );
}
