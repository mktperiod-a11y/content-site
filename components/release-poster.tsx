"use client";

import { useState } from "react";
import { Clapperboard } from "lucide-react";

/**
 * 개봉작 카드 포스터. 주소가 없거나 이미지를 불러오지 못하면 "포스터 준비 중"을
 * 보여준다(깨진 이미지 아이콘 대신).
 *
 * 페이지를 받은 직후 React 가 붙기 전에 이미 실패한 이미지는 onError 가 오지
 * 않으므로, 이미지가 화면에 붙을 때 한 번 더 확인한다.
 */
export function ReleasePoster({
  src,
  alt,
  priority = false,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 px-5 text-center text-sm font-medium text-muted-foreground">
        <Clapperboard className="size-8 opacity-40" />
        <span>포스터 준비 중</span>
      </div>
    );
  }

  const fail = () => setFailedSrc(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- D1에 저장된 TMDB CDN 원격 이미지입니다.
    <img
      alt={alt}
      className="size-full object-cover transition duration-300 group-hover:scale-[1.025]"
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      onError={fail}
      ref={(image) => {
        if (image?.complete && image.naturalWidth === 0) fail();
      }}
      src={src}
    />
  );
}
