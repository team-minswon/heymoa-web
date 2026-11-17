"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Maximize2 } from "lucide-react";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import { helpAssetUrl } from "@/lib/help/asset-url";
import { HELP_MEDIA } from "@/lib/help/media-manifest";
import { localizedHelpMedia } from "@/lib/help/localized-media";
import { trackHelp, useHelpSlug } from "@/lib/help/analytics";
import { HelpZoomDialog } from "@/components/help/help-zoom-dialog";
import { cn } from "@/lib/utils";

export function HelpFigure({
  src,
  alt,
  caption,
  priority = false,
  className,
}: {
  src: keyof typeof HELP_MEDIA & `${string}.webp`;
  alt: string;
  caption?: string;
  priority?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const slug = useHelpSlug();
  const t = useTranslations("help.media");
  const media = localizedHelpMedia(src, useLocale());
  const url = helpAssetUrl(media.path);
  const { width, height } = media;
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
        ref={trigger}
        type="button"
        onClick={() => {
          trackHelp("help_image_zoomed", { name: src, slug });
          setOpen(true);
        }}
        aria-label={t("zoom", { alt })}
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
        <figcaption className="m-0 text-[14px] leading-[1.65] text-[var(--tv-muted)]">
          {caption}
        </figcaption>
      ) : null}
      <HelpZoomDialog
        open={open}
        onOpenChange={setOpen}
        title={alt}
        caption={caption}
        naturalWidth={width}
        finalFocus={() => trigger.current ?? true}
      >
        {image("rounded-[12px] max-h-[calc(92vh-5rem)] object-contain")}
      </HelpZoomDialog>
    </figure>
  );
}
