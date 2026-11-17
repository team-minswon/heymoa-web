import { documentLocale } from "@/lib/i18n/document-locale";
import type { MinutesDocument } from "@/lib/notes/minutes/model";

/** 글꼴을 읽을 자리. 워커 안에서는 상대 경로의 기준이 워커 스크립트라 절대 URL 로 넘긴다 */
const fontBase = () => new URL("/fonts/minutes", window.location.origin).href;

export async function renderMinutesPdf(
  doc: MinutesDocument,
  signal?: AbortSignal
): Promise<Blob> {
  signal?.throwIfAborted();
  const locale = documentLocale() ?? "ko";
  if (typeof Worker === "undefined") {
    const { renderMinutesPdfInline } =
      await import("@/components/notes/minutes/minutes-pdf");
    const blob = await renderMinutesPdfInline(doc, fontBase(), locale);
    signal?.throwIfAborted();
    return blob;
  }
  const worker = new Worker(
    new URL("./minutes-pdf.worker.ts", import.meta.url),
    { type: "module" }
  );
  let abort: (() => void) | undefined;
  try {
    return await new Promise<Blob>((resolve, reject) => {
      abort = () =>
        reject(new DOMException("PDF rendering was canceled", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = (
        event: MessageEvent<
          { ok: true; blob: Blob } | { ok: false; message: string }
        >
      ) =>
        event.data.ok
          ? resolve(event.data.blob)
          : reject(new Error(event.data.message));
      worker.onerror = (event) =>
        reject(event.error ?? new Error(event.message));
      worker.postMessage({ doc, fontBase: fontBase(), locale });
    });
  } finally {
    if (abort) signal?.removeEventListener("abort", abort);
    worker.terminate();
  }
}

export type MinutesPdfArtifact = { blob: Blob; fileName: string };
export type PrepareMinutesPdf = (
  include: import("@/lib/notes/minutes/model").MinutesInclude,
  signal?: AbortSignal
) => Promise<MinutesPdfArtifact>;

export function createMinutesPdfRenderer() {
  const files = new Map<string, Blob>();
  return async (doc: MinutesDocument, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    const key = JSON.stringify(doc);
    const cached = files.get(key);
    if (cached) return cached;
    const blob = await renderMinutesPdf(doc, signal);
    signal?.throwIfAborted();
    files.set(key, blob);
    if (files.size > 2) files.delete(files.keys().next().value!);
    return blob;
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 바로 풀면 일부 브라우저가 내려받기를 시작하기 전에 주소를 잃는다
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
