"use client";

import { useEffect, useRef, useState } from "react";

/** 이 길이를 넘으면 모바일에서 넉 줄을 넘길 가능성이 높다고 보고 처음부터 버튼을 둔다. */
const LIKELY_LONG_CHARS = 110;

/**
 * 모바일에서 긴 글을 넉 줄로 줄이고 "더보기"로 펼친다. 넓은 화면(sm 이상)에서는
 * 줄이지 않고 다 보여준다.
 *
 * 서버 렌더와 첫 렌더가 같도록 글 길이로 버튼 표시 여부를 먼저 정하고,
 * 화면에 붙은 뒤 실제로 넘치는지 재서 바로잡는다.
 */
export function ExpandableText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(text.length > LIKELY_LONG_CHARS);

  useEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const measure = () => setOverflowing(element.scrollHeight - element.clientHeight > 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <div>
      <p className={`${expanded ? "" : "line-clamp-4 sm:line-clamp-none"} ${className}`} ref={ref}>
        {text}
      </p>
      {(overflowing || expanded) && (
        <button
          aria-expanded={expanded}
          className="mt-1.5 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:hidden"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
    </div>
  );
}
