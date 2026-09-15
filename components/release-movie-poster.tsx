"use client";

import { useEffect, useRef, useState } from "react";
import { Clapperboard } from "lucide-react";

import type { EnrichedMovie } from "@/lib/enrichment";

export function ReleaseMoviePoster({
  movieCd,
  titleKo,
  titleEn,
  year,
  openDate,
  initialUrl,
  priority = false,
}: {
  movieCd: string | null;
  titleKo: string;
  titleEn: string;
  year: string;
  openDate: string;
  initialUrl: string | null;
  priority?: boolean;
}) {
  const [posterUrl, setPosterUrl] = useState(initialUrl);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (posterUrl || !movieCd) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let requested = false;

    async function loadPoster() {
      if (requested) return;
      requested = true;
      try {
        const response = await fetch("/api/movies/enrich", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: [{ movieCd, titleKo, titleEn, year, openDate }],
          }),
        });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { movies?: EnrichedMovie[] };
        const nextPoster = body.movies?.[0]?.posterUrl;
        if (nextPoster) setPosterUrl(nextPoster);
      } catch {
        // 포스터 보강 실패는 카드와 상세 진입을 막지 않는다.
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void loadPoster();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [movieCd, openDate, posterUrl, titleEn, titleKo, year]);

  return (
    <div className="size-full" ref={containerRef}>
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- TMDB CDN 원격 이미지입니다.
        <img
          alt={`${titleKo} 포스터`}
          className="size-full object-cover transition duration-300 group-hover:scale-[1.025]"
          loading={priority ? "eager" : "lazy"}
          src={posterUrl}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-5 text-center text-sm font-medium text-muted-foreground">
          <Clapperboard className="size-8 opacity-40" />
          <span>포스터 준비 중</span>
        </div>
      )}
    </div>
  );
}
