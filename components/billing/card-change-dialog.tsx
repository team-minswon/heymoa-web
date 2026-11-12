"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cardChangeFramePath,
  cardChangeFrameSkeleton,
  cardEntryEventOf,
} from "@/lib/billing/card-entry-frame";
import { goToSetupResult } from "@/lib/billing/navigate";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

/**
 * 결제 관리의 카드 변경·등록 모달(APP-1600). 이 문서(설정 창)에는 분석 스크립트가 있어 **카드 칸·동의를 여기 두지 않는다** —
 * 모달 본문은 분석 없는 카드 변경 문서(`/billing/card-change/{id}`, CSP `frame-ancestors 'self'`)를 싣는 iframe 하나다.
 * 부모는 열고 닫기만 하고, 높이·진행·결과만 `postMessage` 로 받는다(`lib/billing/card-entry-frame.ts`).
 *
 * 닫으면(X·바깥·Esc) iframe 을 떼어 입력 값도 사라진다. 연 등록은 남아 다시 열면 그 등록에 이어 낸다. 제출 중에는 닫지 않는다.
 * 변경이 끝나면 닫고 결제 관리를 새로 읽어 알리고, 결과를 모르면 결과 화면으로 문서를 새로 연다.
 * 폭 640px 미만에서는 화면 전체를 채운다(제목·닫기 위, 본문 스크롤 한 겹).
 */
export function CardChangeDialog({
  workspaceId,
  open,
  register,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  /** 지금 카드가 없어 「카드 등록」이다(APP-1588). */
  register: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("billing.checkout");
  const queryClient = useQueryClient();
  const submittingRef = useRef(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submittingRef.current) onClose();
      }}
    >
      {/* 닫을 때 서서히 사라지지 않게 한다 — 그동안 iframe 이 남지 않고, 화면 전환 효과도 줄인다. */}
      <DialogContent
        className="ph-no-capture content-start gap-5 overflow-y-auto p-6 data-closed:animate-none sm:max-h-[calc(100dvh-2rem)] sm:max-w-[480px] max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:p-5 max-sm:ring-0"
        overlayClassName="data-closed:animate-none"
      >
        {open ? (
          <CardChangeFrame
            workspaceId={workspaceId}
            title={register ? t("replace.register.title") : t("replace.title")}
            register={register}
            submittingRef={submittingRef}
            onEscape={() => {
              if (!submittingRef.current) onClose();
            }}
            onChanged={() => {
              onClose();
              void invalidateWorkspaceBilling(queryClient, workspaceId);
              toast.success(
                register ? t("replace.registered") : t("replace.changed")
              );
            }}
            onResult={(setupId) => {
              onClose();
              goToSetupResult(setupId);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CardChangeFrame({
  workspaceId,
  title,
  register,
  submittingRef,
  onEscape,
  onChanged,
  onResult,
}: {
  workspaceId: string;
  title: string;
  register: boolean;
  submittingRef: RefObject<boolean>;
  onEscape: () => void;
  onChanged: () => void;
  onResult: (setupId: string) => void;
}) {
  const t = useTranslations("billing.checkout");
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const escape = useEffectEvent(onEscape);
  const changed = useEffectEvent(onChanged);
  const result = useEffectEvent(onResult);

  useEffect(() => {
    submittingRef.current = false;
    const onMessage = (event: MessageEvent) => {
      const message = cardEntryEventOf(event, frame.current);
      if (!message) return;
      if (message.event === "height") setHeight(message.height);
      else if (message.event === "submitting")
        submittingRef.current = message.submitting;
      else if (message.event === "escape") escape();
      else {
        submittingRef.current = false;
        if (message.event === "changed") changed();
        else result(message.setupId);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      submittingRef.current = false;
    };
  }, [submittingRef]);

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle className="text-lg text-balance">{title}</DialogTitle>
      </DialogHeader>
      <div className="relative">
        {height === null ? (
          <Skeleton
            aria-label={t("replace.loading")}
            className={cardChangeFrameSkeleton(register)}
          />
        ) : null}
        <iframe
          ref={frame}
          src={cardChangeFramePath(workspaceId)}
          title={title}
          referrerPolicy="no-referrer"
          allow=""
          className={cn(
            "block w-full border-0",
            height === null && "absolute inset-x-0 top-0 h-0"
          )}
          style={height === null ? undefined : { height }}
        />
      </div>
    </>
  );
}
