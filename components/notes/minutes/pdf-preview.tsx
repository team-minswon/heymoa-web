"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function PdfPreview({
  blob,
  children,
}: {
  blob: Blob | null;
  children?: ReactNode;
}) {
  const t = useTranslations("notes.minutes.preview");
  const frame = useRef<HTMLIFrameElement>(null);
  const link = useRef<HTMLAnchorElement>(null);
  useLayoutEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (frame.current) frame.current.src = url;
    if (link.current) link.current.href = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return (
    <div className="mt-3 space-y-2">
      <a
        ref={link}
        target="_blank"
        rel="noreferrer"
        aria-hidden={!blob || undefined}
        tabIndex={blob ? undefined : -1}
        className={cn(
          "text-sm underline underline-offset-4",
          !blob && "invisible"
        )}
      >
        {t("openInTab")}
      </a>
      {blob ? (
        <iframe
          ref={frame}
          title={t("frameTitle")}
          className="hidden h-[min(50vh,560px)] w-full rounded-control border sm:block"
        />
      ) : (
        <div className="grid h-[min(50vh,560px)] w-full place-items-center rounded-control border border-dashed p-6 text-center max-sm:h-auto max-sm:border-0 max-sm:p-0 max-sm:text-left">
          {children}
        </div>
      )}
    </div>
  );
}
