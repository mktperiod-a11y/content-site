"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 개봉작 목록의 "N편 더 보기" 영역.
 *
 * 펼친 채로 카드를 눌러 상세에 갔다가 뒤로 오면, 다시 그려진 목록이 접혀 있어 페이지가
 * 짧아지고 보던 위치로 돌아갈 수 없었다. 카드를 누르는 순간 펼침 여부와 스크롤 위치를
 * 이 탭(sessionStorage)에 적어 두고, 뒤로가기로 돌아왔을 때만 다시 펼친 뒤 그 위치로
 * 스크롤한다. 탭 메뉴로 새로 들어오면 지금처럼 맨 위·접힌 상태로 시작한다.
 */

const STORAGE_PREFIX = "release-more:";

/** 뒤로/앞으로 가기로 이 화면이 다시 그려지는지. 클라이언트 이동은 popstate 로 안다. */
let navigatedByHistory = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    navigatedByHistory = true;
  });
}

function cameBack() {
  if (navigatedByHistory) return true;
  // 상세에서 새로고침 등으로 문서째 돌아온 경우
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === "back_forward";
}

type Snapshot = { open: boolean; y: number };

function readSnapshot(key: string): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export function ReleaseMoreDetails({
  storageKey,
  summary,
  children,
}: {
  /** 최신 개봉작·개봉 예정작을 따로 기억하도록 화면마다 다른 값을 준다. */
  storageKey: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const key = STORAGE_PREFIX + storageKey;

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    const back = cameBack();
    navigatedByHistory = false;
    const snapshot = readSnapshot(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // 저장소를 못 쓰는 환경이면 복원 없이 그대로 둔다.
    }
    if (!back || !snapshot) return;

    if (snapshot.open) details.open = true;
    // 펼친 목록이 그려진 뒤에 스크롤해야 위치가 잘리지 않는다. 라우터의 스크롤 처리가
    // 끝난 뒤에도 한 번 더 맞춘다.
    const restore = () => window.scrollTo(0, snapshot.y);
    const frame = requestAnimationFrame(restore);
    const timer = window.setTimeout(restore, 120);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [key]);

  useEffect(() => {
    // 이 화면의 영화 카드(펼친 영역 밖의 카드 포함)를 누르는 순간을 기록한다.
    const onClick = (event: MouseEvent) => {
      // 상세로 가는 카드와, KOBIS에 아직 없어 검색으로 보내는 카드 둘 다 해당한다.
      const link = (event.target as Element | null)?.closest?.('a[href^="/movie/"], a[href^="/search?q="]');
      if (!link || !ref.current) return;
      try {
        sessionStorage.setItem(key, JSON.stringify({ open: ref.current.open, y: window.scrollY }));
      } catch {
        // 저장 실패는 복원만 못 할 뿐 이동에는 영향이 없다.
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [key]);

  return (
    <details className="group mt-6" ref={ref}>
      {summary}
      {children}
    </details>
  );
}
