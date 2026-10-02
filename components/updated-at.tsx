"use client";

import { useSyncExternalStore } from "react";

/**
 * 목록의 "마지막 갱신" 표시. `● 오늘 오후 2:40 갱신 · 3시간 전`
 *
 * "몇 분 전"은 보는 사람의 시계에 달려 서버에서 그릴 수 없다(그리면 서버와 브라우저의
 * 글자가 달라 화면이 다시 그려진다). 서버는 날짜와 시각만 그리고, 브라우저가 붙은 뒤
 * "오늘/어제"와 "몇 분 전"을 채워 1분마다 고친다.
 *
 * 점은 갱신이 정상이면 빨간색으로 깜빡이고, 기한이 지났거나 실패했으면 회색이다.
 */

const MINUTE = 60 * 1000;
const TIME_ZONE = "Asia/Seoul";

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, MINUTE);
  return () => window.clearInterval(timer);
}

/** 분 단위로 끊어야 1분 동안 같은 값을 돌려줘 불필요하게 다시 그리지 않는다. */
const getNow = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const getServerNow = () => null;

function seoulDay(value: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(value));
}

function formatClock(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDay(value: number, now: number | null) {
  if (now !== null) {
    if (seoulDay(value) === seoulDay(now)) return "오늘";
    if (seoulDay(value) === seoulDay(now - 24 * 60 * MINUTE)) return "어제";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatAgo(value: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - value) / MINUTE));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function UpdatedAt({ at, healthy }: { at: number | null; healthy: boolean }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span aria-hidden="true" className="relative flex size-2">
        {healthy && (
          <span className="absolute inline-flex size-full rounded-full bg-red-500 opacity-60 motion-safe:animate-ping" />
        )}
        <span
          className={`relative inline-flex size-2 rounded-full ${healthy ? "bg-red-500" : "bg-muted-foreground/45"}`}
        />
      </span>
      {at ? (
        <span>
          {formatDay(at, now)} {formatClock(at)} 갱신
          {now !== null && ` · ${formatAgo(at, now)}`}
        </span>
      ) : (
        <span>첫 수집 전</span>
      )}
    </span>
  );
}
