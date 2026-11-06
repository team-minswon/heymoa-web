/**
 * 가이드 캡처 프리셋의 언어 (APP-1511). 영어 가이드의 이미지·영상은 영어 화면에 영어 회의를 담아야 하므로,
 * 문서가 영어(`<html lang="en">`)이면 같은 ID·같은 모양의 영어 데이터(`./en/`)를 쓴다.
 *
 * Node(vitest · SSR)에서는 늘 ko 다 — 시험은 `createHelpDemoState(now, "en")` 처럼 언어를 직접 넘긴다.
 */
export type HelpDemoLocale = "ko" | "en";

export function helpDemoLocale(): HelpDemoLocale {
  if (typeof document === "undefined") return "ko";
  return document.documentElement.lang === "en" ? "en" : "ko";
}
