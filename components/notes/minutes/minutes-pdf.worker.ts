import { renderMinutesPdfInline } from "@/components/notes/minutes/minutes-pdf";
import type { MinutesDocument } from "@/lib/notes/minutes/model";

/**
 * 회의록 PDF 를 화면 밖에서 만든다. react-pdf 는 쪽 나누기를 한 스레드에서 끝까지 돌아, 1시간 회의는 2초 남짓,
 * 3시간 회의는 9초 가까이 화면을 붙든다 — 그동안 버튼의 진행 표시도 멈춘다.
 */
self.onmessage = async (
  event: MessageEvent<{ doc: MinutesDocument; fontBase: string }>
) => {
  try {
    const blob = await renderMinutesPdfInline(
      event.data.doc,
      event.data.fontBase
    );
    self.postMessage({ ok: true, blob });
  } catch (error) {
    self.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
