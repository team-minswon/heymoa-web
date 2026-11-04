import en from "@/messages/en/errors.json";
import ko from "@/messages/ko/errors.json";

import { documentLocale } from "./document-locale";

export type WebMessageKey = keyof typeof ko;

/**
 * React 밖 모듈(`fetcher`·토스트 fallback·녹음 소켓)이 고르는 web 자체 문구. 화면 언어(`<html lang>`)를 따른다.
 * 언어를 바꾸면 문서를 새로 열므로 문서 수명 동안 언어가 고정이다. 컴포넌트·훅은 `useTranslations("errors")` 를 쓴다 —
 * SSR 에는 `document` 가 없어 여기서는 늘 한국어가 나와 하이드레이션이 어긋난다.
 *
 * `i18n/messages.ts` 를 import 하지 않는다. 랜딩·가이드 문구까지 fetcher 를 쓰는 모든 번들에 실린다.
 */
export function webMessage(
  key: WebMessageKey,
  values: Record<string, string> = {}
): string {
  // 자리표시자는 `{name}` 하나뿐이다(복수·select 가 필요한 문구는 컴포넌트가 `useTranslations` 로 그린다)
  return (documentLocale() === "en" ? en : ko)[key].replace(
    /\{(\w+)\}/g,
    (whole, name: string) => values[name] ?? whole
  );
}
