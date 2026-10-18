"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELP_OVERLAY, HELP_VARS } from "@/components/help/help-vars";

/** 확대 창 바깥 상한(px). 이보다 크게 열지 않는다(1440 에서 1200). */
const MAX_WIDTH = 1200;
const PADDING = 24;

/**
 * 가이드 이미지 · 영상의 확대 창 — **한 곳**. 이미지(`HelpFigure`)와 영상(`HelpClip`)이 같은 크기 규칙을 쓰도록 합쳤다.
 *
 * 크기 규칙: 폭은 뷰포트 폭에서 양옆 1rem 을 뺀 안에서 `MAX_WIDTH` 까지, 그리고 **원본 폭(`naturalWidth`)을 넘지 않는다**(업스케일로
 * 흐려지지 않게). 높이는 92vh 안이고 미디어가 비율을 지킨다. 폭을 `style` 로 직접 정한다 — 예전 이미지 확대 창은 `w-auto` 라서 안의
 * `w-full` 이미지와 서로를 기다려 본문보다 작게(488px) 열렸다. 미디어는 `w-full` 로 이 폭을 꽉 채운다.
 * Esc · 바깥 눌러 닫기 · 포커스 가둠은 `Dialog` 가, 닫힌 뒤 포커스 복귀는 `finalFocus` 가 맡는다.
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={HELP_OVERLAY}
        finalFocus={finalFocus}
        style={{ ...HELP_VARS, width: `min(${width}px, calc(100vw - 2rem))` }}
        className="max-h-[92vh] max-w-none gap-2 overflow-auto rounded-[20px] bg-white p-3 text-[var(--tv-ink)] duration-200 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
        {caption ? (
          <DialogDescription className="m-0 px-1 text-[14px] leading-[1.65] break-keep text-[var(--tv-muted)]">
            {caption}
          </DialogDescription>
        ) : (
          <DialogDescription className="sr-only">
            Esc를 누르면 확대 창이 닫혀요.
          </DialogDescription>
        )}
      </DialogContent>
    </Dialog>
  );
}
