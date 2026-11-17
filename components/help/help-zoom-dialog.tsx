"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELP_OVERLAY, HELP_VARS } from "@/components/help/help-vars";

const MAX_WIDTH = 1200;
const PADDING = 24;

/**
 * 스크롤 잠금은 `modal="trap-focus"` 로 Base UI 의 것을 끄고 CSS 로 합니다(`app/globals.css` 의 「가이드 대화상자 스크롤 잠금」).
 * Base UI 의 잠금은 스크롤바가 있을 때 body 를 스크롤 컨테이너로 바꿔 고정 상단바 · 사이드바를 위로 끌어올립니다.
 */
export function HelpZoomDialog({
  open,
  onOpenChange,
  title,
  caption,
  naturalWidth,
  finalFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  caption?: string;
  naturalWidth: number;
  finalFocus?: () => HTMLElement | boolean | null;
  children: React.ReactNode;
}) {
  const width = Math.min(naturalWidth + PADDING, MAX_WIDTH);
  const t = useTranslations("help.media");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal="trap-focus">
      <DialogContent
        overlayClassName={HELP_OVERLAY}
        finalFocus={
          finalFocus &&
          (() => {
            const target = finalFocus();
            if (!(target instanceof HTMLElement)) return target;
            // 긴 이미지 버튼으로 포커스를 돌릴 때 브라우저가 문서를 다시 스크롤하지 않게 합니다.
            target.focus({ preventScroll: true });
            return false;
          })
        }
        style={{ ...HELP_VARS, width: `min(${width}px, calc(100vw - 2rem))` }}
        className="max-h-[92vh] max-w-none gap-2 overflow-auto rounded-[20px] bg-white p-3 text-[var(--tv-ink)] duration-(--help-base) motion-reduce:duration-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
        {caption ? (
          <DialogDescription className="m-0 px-1 text-[14px] leading-[1.65] text-[var(--tv-muted)]">
            {caption}
          </DialogDescription>
        ) : (
          <DialogDescription className="sr-only">
            {t("zoomClose")}
          </DialogDescription>
        )}
      </DialogContent>
    </Dialog>
  );
}
