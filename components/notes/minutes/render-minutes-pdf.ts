import type { MinutesDocument } from "@/lib/notes/minutes/model";

/** 글꼴을 읽을 자리. 워커 안에서는 상대 경로의 기준이 워커 스크립트라 절대 URL 로 넘긴다 */
const fontBase = () => new URL("/fonts/minutes", window.location.origin).href;

/**
 * 회의록 PDF 한 벌. 다운로드와 메일 첨부가 이 Blob 하나를 같이 쓴다.
 *
 * **워커에서 만든다.** react-pdf · 글꼴은 이 함수를 부를 때 처음 읽힌다 — 노트 화면 번들에는 이 파일만 든다.
 * 워커가 없는 환경(jsdom)에서는 이 스레드에서 만든다.
 */
export async function renderMinutesPdf(doc: MinutesDocument, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  if (typeof Worker === "undefined") {
    const { renderMinutesPdfInline } = await import("@/components/notes/minutes/minutes-pdf");
    const blob = await renderMinutesPdfInline(doc, fontBase());
    signal?.throwIfAborted();
    return blob;
  }
  const worker = new Worker(new URL("./minutes-pdf.worker.ts", import.meta.url), { type: "module" });
  let abort: (() => void) | undefined;
  try {
    return await new Promise<Blob>((resolve, reject) => {
      abort = () => reject(new DOMException("PDF 생성이 취소되었습니다", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = (event: MessageEvent<{ ok: true; blob: Blob } | { ok: false; message: string }>) =>
        event.data.ok ? resolve(event.data.blob) : reject(new Error(event.data.message));
      worker.onerror = (event) => reject(event.error ?? new Error(event.message || "회의록 PDF 워커가 멈췄습니다"));
      worker.postMessage({ doc, fontBase: fontBase() });
    });
  } finally {
    if (abort) signal?.removeEventListener("abort", abort);
    worker.terminate();
  }
}

export type MinutesPdfArtifact = { blob: Blob; fileName: string };
export type PrepareMinutesPdf = (include: import("@/lib/notes/minutes/model").MinutesInclude, signal?: AbortSignal) => Promise<MinutesPdfArtifact>;

/** 한 회의 화면에서 최근 두 옵션의 결과만 재사용한다. 실패·취소된 파일은 보관하지 않는다. */
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

/** 받은 Blob 을 파일로 내려받는다. 링크를 잠깐 붙였다 뗀다 — 보이는 자리에 남기지 않는다 */
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
