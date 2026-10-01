/**
 * TMDB 이용약관상 필수 출처 표기. 사이트 공통 바닥글(site-footer.tsx)에 한 번 둔다.
 *
 * TODO(운영): TMDB는 문구와 함께 공식 로고 표기를 요구합니다.
 * TMDB 브랜드 자산 페이지에서 공식 로고를 내려받아 /public/tmdb-logo.svg 로
 * 추가한 뒤 아래 주석 처리된 <img>를 활성화하세요. (임의로 로고를 그려 넣으면
 * 상표 사용 조건 위반이 될 수 있어 자산은 반드시 공식 파일을 사용해야 합니다.)
 */
export function TmdbNotice() {
  return (
    <p className="flex items-center gap-2">
      {/* <img alt="TMDB" className="h-3" src="/tmdb-logo.svg" /> */}
      This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>
  );
}

/** 작품 상세의 제공처 정보 출처 */
export function JustWatchCredit({ link }: { link?: string }) {
  if (!link) return null;
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      제공처 정보 출처:{" "}
      <a
        className="underline decoration-border underline-offset-4 hover:text-foreground"
        href={link}
        rel="noreferrer"
        target="_blank"
      >
        JustWatch
      </a>
    </p>
  );
}
