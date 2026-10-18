"use client";

import { useLayoutEffect, useRef } from "react";

export function PdfPreview({ blob }: { blob: Blob }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const link = useRef<HTMLAnchorElement>(null);
  useLayoutEffect(() => {
    const url = URL.createObjectURL(blob);
    if (frame.current) frame.current.src = url;
    if (link.current) link.current.href = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return (
    <div className="mt-3 space-y-2">
      <a ref={link} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">PDF를 새 탭에서 보기</a>
      <iframe ref={frame} title="첨부할 회의록 PDF" className="hidden h-[min(50vh,560px)] w-full rounded-control border sm:block" />
    </div>
  );
}
