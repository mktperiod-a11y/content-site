"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function ReleaseRefresh({ shouldRefresh }: { shouldRefresh: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">(
    shouldRefresh ? "loading" : "idle",
  );

  useEffect(() => {
    if (!shouldRefresh) return;
    let active = true;

    async function refresh() {
      try {
        const response = await fetch("/api/releases/refresh", { method: "POST" });
        if (!response.ok) throw new Error("refresh failed");
        if (!active) return;
        setState("idle");
        router.refresh();
      } catch {
        if (active) setState("error");
      }
    }

    void refresh();
    return () => {
      active = false;
    };
  }, [router, shouldRefresh]);

  if (!shouldRefresh || state === "idle") return null;

  if (state === "error") {
    return (
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-bold text-foreground shadow-sm transition-colors hover:border-brand-muted"
        onClick={() => {
          setState("loading");
          fetch("/api/releases/refresh", { method: "POST" })
            .then((response) => {
              if (!response.ok) throw new Error("refresh failed");
              setState("idle");
              router.refresh();
            })
            .catch(() => setState("error"));
        }}
        type="button"
      >
        <RefreshCw className="size-4" />
        목록 다시 불러오기
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <RefreshCw className="size-4 animate-spin" />
      최신 개봉 정보를 준비하고 있어요
    </span>
  );
}
