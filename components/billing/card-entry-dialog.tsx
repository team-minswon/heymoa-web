"use client";

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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cardEntryEventOf,
  cardEntryFramePath,
  cardEntryFrameSkeleton,
} from "@/lib/billing/card-entry-frame";
import { goToSetupResult } from "@/lib/billing/navigate";
import { useSetupSummary } from "@/lib/billing/use-setup-summary";
import { cn } from "@/lib/utils";

/**
 * 카드 정보 입력 모달(APP-1600). 이 문서(설정 창)에는 분석 스크립트가 있어 **카드 칸을 여기 두지 않는다** — 모달 본문은
 * 분석 없는 카드 입력 문서(`/billing/setups/{id}/card/embed`, CSP `frame-ancestors 'self'`)를 싣는 iframe 하나다.
 * 둘은 높이·진행만 `postMessage` 로 주고받는다(`lib/billing/card-entry-frame.ts`).
 *
 * 닫아도(X·바깥·Esc) 등록은 열린 채 남아 다시 누르면 같은 등록으로 연다. 닫으면 iframe 을 떼어 입력 값도 함께 사라진다.
 * 제출 중에는 닫지 않는다. 제출이 끝나면(`done`) 또는 등록이 더는 카드를 받지 않으면 결과 화면으로 문서를 새로 연다.
 */
export function CardEntryDialog({
  setupId,
  replace,
  onClose,
}: {
  /** 카드를 받을 등록. `null` 이면 닫혀 있다. */
  setupId: string | null;
  /** 카드 변경 등록인가 — 등록 조회가 오기 전 자리 높이를 고르는 데만 쓴다(모르면 등록이 오면 맞춘다). */
  replace?: boolean;
  onClose: () => void;
}) {
  const submittingRef = useRef(false);
  return (
    <Dialog
      open={setupId !== null}
      onOpenChange={(open) => {
        if (!open && !submittingRef.current) onClose();
      }}
    >
      {/* 닫을 때 서서히 사라지지 않게 한다 — 그동안 iframe 이 남지 않고, 화면 전환 효과도 줄인다. */}
      <DialogContent
        className="ph-no-capture max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto p-6 sm:max-w-[480px] data-closed:animate-none"
        overlayClassName="data-closed:animate-none"
      >
        {setupId ? (
          <CardEntryFrame
            key={setupId}
            setupId={setupId}
            replace={replace}
            submittingRef={submittingRef}
            onEscape={() => {
              if (!submittingRef.current) onClose();
            }}
            onDone={() => {
              onClose();
              goToSetupResult(setupId);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CardEntryFrame({
  setupId,
  replace,
  submittingRef,
  onEscape,
  onDone,
}: {
  setupId: string;
  replace?: boolean;
  submittingRef: RefObject<boolean>;
  onEscape: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("billing.cardEntry");
  const { setup, summary } = useSetupSummary(setupId);
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const finish = useEffectEvent(onDone);
  const escape = useEffectEvent(onEscape);

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
        finish();
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
        <DialogTitle className="text-lg text-balance">{t("title")}</DialogTitle>
        {summary ? (
          <DialogDescription className="truncate text-[var(--el-muted)]">
            {summary}
          </DialogDescription>
        ) : (
          <Skeleton className="h-5 w-64" />
        )}
      </DialogHeader>
      <div className="relative">
        {height === null ? (
          <Skeleton
            aria-label={t("loading")}
            className={cardEntryFrameSkeleton(
              setup ? setup.purpose === "REPLACE" : Boolean(replace)
            )}
          />
        ) : null}
        <iframe
          ref={frame}
          src={cardEntryFramePath(setupId)}
          title={t("title")}
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
