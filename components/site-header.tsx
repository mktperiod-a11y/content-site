import type { ReactNode } from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";

export function SiteHeader({ navigation }: { navigation?: ReactNode }) {
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

      {navigation && (
        <div className="border-y border-white/10">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">{navigation}</div>
        </div>
      )}
    </header>
  );
}
