"use client";

import { useState } from "react";
import { Clapperboard } from "lucide-react";

/**
 * 개봉작 카드 포스터. 주소를 앞에서부터 쓰다가 불러오지 못하면 다음 주소로,
 * 다 실패하면 "포스터 준비 중"을 보여준다.
 *
 * 극장사 포스터는 극장 쪽 서버가 다른 사이트에서의 사용을 막을 수 있어 실패를
 * 전제로 둔다. 페이지를 받은 직후 React 가 붙기 전에 이미 실패한 이미지는 onError 가
 * 오지 않으므로, 이미지가 화면에 붙을 때 한 번 더 확인한다.
 */
export function ReleasePoster({
  sources,
  alt,
  priority = false,
}: {
  sources: string[];
  alt: string;
  priority?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const src = sources[index];

  if (!src) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 px-5 text-center text-sm font-medium text-muted-foreground">
        <Clapperboard className="size-8 opacity-40" />
        <span>포스터 준비 중</span>
      </div>
    );
  }

  const next = () => setIndex((current) => (current === index ? current + 1 : current));

  return (
    // eslint-disable-next-line @next/next/no-img-element -- TMDB·극장사 CDN 원격 이미지입니다.
    <img
      alt={alt}
      className="size-full object-cover transition duration-300 group-hover:scale-[1.025]"
      fetchPriority={priority ? "high" : "auto"}
      key={src}
      loading={priority ? "eager" : "lazy"}
      onError={next}
      ref={(image) => {
        if (image?.complete && image.naturalWidth === 0) next();
      }}
      // 극장사 이미지 서버가 다른 사이트에서 온 요청(Referer)을 막는 경우가 있다.
      referrerPolicy="no-referrer"
      src={src}
    />
  );
}
