import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

export default function MovieNotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
        <p className="text-sm font-semibold text-muted-foreground">작품을 찾을 수 없어요</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          요청하신 작품 정보를 확인할 수 없어요.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          작품 코드가 정확한지 확인하거나, 다시 검색해주세요.
        </p>
        <Button asChild className="mt-8 rounded-xl">
          <Link href="/search">
            <ArrowLeft className="size-4" />
            다시 검색하기
          </Link>
        </Button>
      </section>
    </main>
  );
}

