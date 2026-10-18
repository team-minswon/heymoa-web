"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { helpAssetUrl } from "@/lib/help/asset-url";
import { HELP_MEDIA } from "@/lib/help/media-manifest";
import { HELP_VARS } from "@/components/help/help-vars";
import { cn } from "@/lib/utils";

/**
 * 가이드 설명 이미지. 캡처 스크립트(`pnpm help:shots`)가 미리 WebP 로 줄여 `public/help/<주제>/` 에 둔 파일을 **변환 없이 그대로**
 * 서빙한다 — Vercel 이미지 최적화(변환 한도)를 쓰지 않으려는 것이다. 그래서 평범한 `<img>` 이고 `width`·`height` 를
 * 목록에서 읽어 적어 자리를 미리 잡는다(레이아웃 점프 0). 눌러서 크게 볼 수 있다(Dialog: Esc 로 닫고 포커스가 갇힌다).
 */
export function HelpFigure({
  src,
  alt,
  caption,
  priority = false,
  className,
}: {
  /** `public/help/` 아래 경로. 예: `recording/dock.webp` */
  src: keyof typeof HELP_MEDIA & `${string}.webp`;
  /** 그 단계가 무엇을 보여 주는지. 화면 글자를 그대로 읽어 주지 않고 하는 일을 적는다. */
  alt: string;
  caption?: string;
  /** 페이지 첫 화면에 보이는 대표 이미지만 true. */
  priority?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const url = helpAssetUrl(src);
  // 크기는 캡처 스크립트가 쓴 목록(`lib/help/media-manifest.ts`)에서 읽는다 — 자리를 미리 잡는다.
  const { width, height } = HELP_MEDIA[src];
  const image = (extra?: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- 미리 줄여 둔 정적 WebP 를 그대로 서빙한다(이미지 최적화 한도를 쓰지 않는다)
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn("h-auto w-full", extra)}
    />
  );
  return (
    <figure data-reveal="" className={cn("m-0 flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} — 크게 보기`}
        className={cn(
          "group/fig relative block cursor-zoom-in overflow-hidden rounded-[16px] border border-[var(--tv-rule)] bg-[var(--tv-lav-soft)] p-0 shadow-(--help-shadow) help-fade hover:shadow-(--help-shadow-hover) motion-reduce:transition-none",
          FOCUS
        )}
      >
        {image()}
        <span
          aria-hidden
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-white/90 text-[var(--tv-ink)] opacity-0 help-fade group-hover/fig:opacity-100 group-focus-visible/fig:opacity-100 motion-reduce:transition-none"
        >
          <Maximize2 className="size-4" />
        </span>
      </button>
      {caption ? (
        <figcaption className="m-0 text-[14px] leading-[1.65] break-keep text-[var(--tv-muted)]">
          {caption}
        </figcaption>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          style={HELP_VARS}
          className="max-h-[92vh] w-auto duration-200 max-w-[min(1240px,calc(100vw-2rem))] gap-3 overflow-auto rounded-[20px] bg-white p-3 text-[var(--tv-ink)] sm:max-w-[min(1240px,calc(100vw-2rem))]"
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">
            Esc를 누르면 확대 창이 닫혀요.
          </DialogDescription>
          {image("rounded-[12px]")}
        </DialogContent>
      </Dialog>
    </figure>
  );
}
