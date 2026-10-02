"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { readReleaseOrigin } from "@/components/release-more-details";

const CLASS_NAME =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-[15px] font-bold text-white shadow-lg shadow-black/15 backdrop-blur transition-colors hover:border-brand/70 hover:bg-white/15 hover:text-brand";

/** 기록은 이 화면에 있는 동안 바뀌지 않으므로 구독할 것이 없다. */
const subscribeNothing = () => () => {};

const ORIGIN_LABEL = { now: "개봉작 목록으로", upcoming: "개봉 예정작 목록으로" } as const;

/**
 * 작품 상세 맨 위의 돌아가기 버튼.
 *
 * 개봉작(또는 개봉 예정작) 목록의 카드를 눌러 들어왔으면 "목록으로"가 되어 뒤로가기처럼
 * 그 목록으로 돌아간다. 그러면 목록이 "더 보기"를 펼친 상태와 보던 위치를 되살린다
 * (release-more-details.tsx). 검색이나 주소로 바로 들어왔으면 지금처럼 영화 찾기로 보낸다.
 * 서버 렌더와 맞추려고 처음엔 검색 버튼으로 그리고, 화면에 붙은 뒤 들어온 곳을 확인한다.
 */
export function DetailBackLink() {
  const router = useRouter();
  // 서버와 하이드레이션 때는 null(검색 버튼), 그 뒤엔 이 탭에 적힌 기록으로 정한다.
  const origin = useSyncExternalStore(
    subscribeNothing,
    () => readReleaseOrigin(window.location.pathname),
    () => null,
  );

  if (!origin) {
    return (
      <Link className={CLASS_NAME} href="/search">
        <ArrowLeft className="size-4.5" strokeWidth={2.5} />
        다른 작품 검색하기
      </Link>
    );
  }

  return (
    <Link
      className={CLASS_NAME}
      href={origin === "upcoming" ? "/movies/upcoming" : "/movies/now"}
      onClick={(event) => {
        // 새 탭으로 열기 등은 브라우저에 맡긴다.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        router.back();
      }}
    >
      <ArrowLeft className="size-4.5" strokeWidth={2.5} />
      {ORIGIN_LABEL[origin]}
    </Link>
  );
}
