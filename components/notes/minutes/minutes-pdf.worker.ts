import { renderMinutesPdfInline } from "@/components/notes/minutes/minutes-pdf";
import type { Locale } from "@/lib/i18n/locales";
import type { MinutesDocument } from "@/lib/notes/minutes/model";

/** react-pdf 는 쪽 나누기를 한 스레드에서 끝까지 돌아 긴 회의는 수 초간 화면을 붙든다. 그래서 워커에서 만든다. */
self.onmessage = async (
  event: MessageEvent<{
    doc: MinutesDocument;
    fontBase: string;
    locale: Locale;
  }>
) => {
  try {
    const blob = await renderMinutesPdfInline(
      event.data.doc,
      event.data.fontBase,
      event.data.locale
    );
    self.postMessage({ ok: true, blob });
  } catch (error) {
    self.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
