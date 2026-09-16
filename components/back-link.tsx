"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * 들어온 곳으로 되돌리는 링크.
 *
 * `/watch-options`는 여러 곳에서 들어온다 — 가격 비교 결과의 배너, 작품 상세
 * 사이드바의 배너. 그런데 돌아가는 버튼이 진입 경로와 무관하게 늘 가격 비교
 * 탭으로 보내서, 1탭 > 작품 상세에서 들어온 사람은 가본 적도 없는 화면으로
 * 튕겼다.
 *
 * 앱 안에서 들어왔으면 브라우저 히스토리로 되돌리고, 새 탭·북마크·검색 유입처럼
 * 돌아갈 곳이 없을 때만 `fallbackHref`로 보낸다. 서버에서는 그냥 평범한 링크로
 * 그려지므로 자바스크립트가 없어도 동작하고 크롤러도 따라갈 수 있다.
 */
export function BackLink({
  children,
  className,
  fallbackHref,
}: {
  children: ReactNode;
  className?: string;
  fallbackHref: string;
}) {
  const router = useRouter();

  return (
    <Link
      className={className}
      href={fallbackHref}
      onClick={(event) => {
        // 새 탭·다운로드 등 브라우저에 맡겨야 하는 클릭은 건드리지 않는다.
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        // 화면 안 이동(pushState)은 referrer를 바꾸지 않아 history.length로 보고,
        // 전체 새로고침으로 들어온 경우는 referrer로 본다. 둘 중 하나면 충분하다.
        let cameFromInsideApp = false;
        try {
          cameFromInsideApp =
            window.history.length > 1 ||
            (Boolean(document.referrer) &&
              new URL(document.referrer).origin === window.location.origin);
        } catch {
          cameFromInsideApp = false;
        }

        if (!cameFromInsideApp) return;
        event.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
