import { isLocale, type Locale } from "./locales";

/**
 * 지금 문서의 화면 언어(`<html lang>`). 브라우저 요청이 `Accept-Language` 로 서버에 알린다 — 서버 오류 문구가 화면과
 * 같은 언어로 오게(server `ApiLocaleResolver`). 서버에서 돌거나 모르는 값이면 null 이고, 그때는 헤더를 붙이지 않는다.
 *
 * `<html lang>` 이 정본인 이유: SSR 이 정한 언어(`productLocale`, 마케팅 root param)가 그대로 실린 값이라 렌더된 문구와
 * 어긋날 수 없다. 언어를 바꾸면 문서를 새로 연다(설정의 언어 탭).
 */
export function documentLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const lang = document.documentElement.lang;
  return isLocale(lang) ? lang : null;
}

/** 요청 헤더에 펼쳐 넣는 꼴. 호출부가 직접 준 `Accept-Language` 가 있으면 뒤에서 덮는다. */
export function acceptLanguageHeader(): Record<string, string> {
  const locale = documentLocale();
  return locale ? { "Accept-Language": locale } : {};
}
