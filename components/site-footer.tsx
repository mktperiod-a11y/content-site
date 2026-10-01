import { TmdbNotice } from "@/components/tmdb-attribution";

/** 모든 화면 맨 아래의 바닥글. 왼쪽에 데이터 출처, 오른쪽에 TMDB 필수 표기를 한 줄로 둔다. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-5 py-6 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
        <p>영화 정보 출처: KOBIS(영화진흥위원회) · TMDB</p>
        <TmdbNotice />
      </div>
    </footer>
  );
}
