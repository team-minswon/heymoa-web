"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * `blob` 이 없으면(포함 항목이 바뀌어 다시 만들어야 할 때) 같은 크기의 빈 틀에 `children` 을 그린다(APP-1356).
 * 틀을 걷으면 미리보기를 연 창이 그만큼 줄었다가 다시 미리보면 또 늘었다.
 */
export function PdfPreview({
  blob,
  children,
}: {
  blob: Blob | null;
  children?: ReactNode;
}) {
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
        PDF를 새 탭에서 보기
      </a>
      {blob ? (
        <iframe
          ref={frame}
          title="첨부할 회의록 PDF"
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
