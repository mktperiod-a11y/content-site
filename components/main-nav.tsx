import Link from "next/link";
import { CalendarDays } from "lucide-react";

const LINK_CLASS =
  "inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[15px] font-bold text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white";

/**
 * 상세 화면처럼 세 탭 어디에도 속하지 않는 화면에서 쓰는 상단 탭 줄.
 * 모양은 개봉작 화면의 탭 줄과 같고, 선택된 탭 없이 보여준다.
 */
export function MainNav() {
  return (
    <nav aria-label="주요 기능" className="flex h-14 items-center gap-1.5">
      <Link className={LINK_CLASS} href="/movies/now">
        <CalendarDays className="size-4" />
        개봉작
      </Link>
      <Link className={LINK_CLASS} href="/search?tab=compare">
        가격 비교하기
      </Link>
      <Link className={LINK_CLASS} href="/search">
        영화 찾기
      </Link>
    </nav>
  );
}
