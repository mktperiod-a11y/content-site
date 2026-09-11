"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const KDISK_SIGNUP_URL = "https://m.kdisk.co.kr/web/member/join.html";

/**
 * "구독형 OTT에서 확인되지 않는 작품"에 대해서만 노출하는 2뎁스 안내.
 * 사용자가 "다른 이용 방법 확인하기"를 직접 눌러야 KDisk가 언급되며,
 * 이용 가능 여부를 단정하는 문구는 사용하지 않는다.
 */
export function KdiskFlow({ title }: { title: string }) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function prepareKdiskFlow() {
    let didCopy = false;

    try {
      await navigator.clipboard.writeText(title);
      didCopy = true;
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = title;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      didCopy = document.execCommand("copy");
      textArea.remove();
    }

    setCopied(didCopy);
    setDialogOpen(true);
  }

  return (
    <aside className="rounded-[1.6rem] bg-ink p-6 text-white shadow-[0_22px_70px_rgba(25,35,55,0.14)] sm:p-7">
      <p className="text-lg font-bold leading-snug">
        현재 구독형 OTT에서는 확인되지 않는 이 작품,
        <br />
        어떻게 보는 게 합리적일까요?
      </p>

      {!expanded ? (
        <Button
          className="mt-6 h-12 w-full rounded-xl bg-white/10 text-base font-bold text-white hover:bg-white/15"
          data-ga-event="kdisk_alt_option_expand"
          onClick={() => setExpanded(true)}
          type="button"
        >
          다른 이용 방법 확인하기
          <ArrowRight className="size-4" />
        </Button>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
            KDisk · 작품별 이용
          </p>
          <p className="mt-2 text-sm leading-6 text-white/62">
            신규 가입 혜택을 적용할 수 있어요.
          </p>
          <Button
            className="mt-5 h-12 w-full rounded-xl bg-brand text-base font-bold text-ink hover:bg-brand-bright"
            data-content-title={title}
            data-ga-event="kdisk_content_cta_click"
            onClick={prepareKdiskFlow}
            type="button"
          >
            작품 확인하기
            <ArrowRight className="size-4" />
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-white/38">
            실제 보유 여부는 KDisk 검색 결과에서 확인해주세요.
          </p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="overflow-hidden rounded-[1.5rem] border-0 p-0 sm:max-w-md">
          <div className="bg-ink px-6 pb-6 pt-7 text-white">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand text-ink">
              {copied ? <Check className="size-5" strokeWidth={3} /> : <Copy className="size-5" />}
            </span>
            <DialogHeader className="mt-5 text-left">
              <DialogTitle className="text-2xl leading-tight">
                {copied ? "작품명을 복사해뒀어요" : "작품명을 확인해주세요"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-white/58">
                가입을 마친 뒤 KDisk 검색창에 붙여넣으면 됩니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-6">
            <div className="rounded-xl border border-border bg-muted px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">검색할 작품명</p>
              <p className="mt-1 font-bold">{title}</p>
            </div>

            <ol className="mt-5 space-y-3 text-sm leading-6">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-accent-foreground">1</span>
                <span>KDisk 무료 회원가입을 완료하세요.</span>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-accent-foreground">2</span>
                <span>검색창에 복사한 작품명을 붙여넣으세요.</span>
              </li>
            </ol>

            <DialogFooter className="mt-6">
              <Button asChild className="h-12 w-full rounded-xl bg-brand text-base font-bold text-ink hover:bg-brand-bright">
                <a
                  data-content-title={title}
                  data-ga-event="kdisk_signup_outbound_click"
                  href={KDISK_SIGNUP_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  무료 가입하고 계속하기
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </DialogFooter>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
              가입 혜택은 KDisk 운영 정책에 따라 달라질 수 있어요. 가입 완료 후 원래
              페이지로 자동으로 돌아오지는 않아요.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

