import Link from "next/link";
import { Clapperboard } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-ink text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link className="flex items-center gap-2.5 font-semibold tracking-tight" href="/">
          <span className="grid size-8 place-items-center rounded-xl bg-brand text-ink">
            <Clapperboard className="size-4.5" strokeWidth={2.4} />
          </span>
          <span>어디서 보지?</span>
        </Link>

        <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/60">
          국내 제공처 기준
        </span>
      </div>
    </header>
  );
}
