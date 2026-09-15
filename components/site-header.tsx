import type { ReactNode } from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";

import { HeaderSearch } from "@/components/header-search";

/**
 * `search`를 주면 그 검색창을 쓰고, 주지 않으면 `/?q=`로 이동하는 기본 전역 검색창을 쓴다.
 * 홈은 검색 탭의 결과 영역을 직접 갱신해야 해서 자기 검색창을 넘긴다.
 */
export function SiteHeader({
  navigation,
  search,
}: {
  navigation?: ReactNode;
  search?: ReactNode;
}) {
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link className="flex items-center gap-2.5 font-semibold tracking-tight" href="/">
          <span className="grid size-8 place-items-center rounded-xl bg-brand text-ink">
            <Clapperboard className="size-4.5" strokeWidth={2.4} />
          </span>
          <span>어디서 보지?</span>
        </Link>

        <span className="text-xs font-medium text-white/45">국내 제공처 기준</span>
      </div>

      <div className="border-y border-white/10">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-col gap-2 px-5 py-2 sm:flex-row sm:items-center sm:gap-4 sm:px-8 sm:py-0">
          {navigation && (
            <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:overflow-visible">
              {navigation}
            </div>
          )}
          <div className="w-full sm:ml-auto sm:w-80 sm:shrink-0">
            {search ?? <HeaderSearch />}
          </div>
        </div>
      </div>
    </header>
  );
}
