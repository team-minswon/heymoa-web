import { DEFAULT_LOCALE, type Locale } from "./locales";

/**
 * 계정도 쿠키도 없을 때 쓰는 **초기 기본값**. 브라우저가 보낸 `Accept-Language` 로 정한다(APP-1285).
 *
 * - 목록에 `ko` 가 하나라도 있으면 순위와 상관없이 ko 다. 영어 OS 를 쓰는 한국어 사용자를 한국어로 남긴다 —
 *   이 제품은 한국어와 영어가 섞인 개발 회의가 우선이고, 그 사람들이 여기 걸린다.
 * - `ko` 가 없고 `en` 이 있으면 en, 둘 다 없거나 헤더가 없으면 ko 다.
 *
 * `next.config.ts` 와 클라이언트가 같이 읽으므로 Next 서버 API 를 들이지 않는다.
 */
export function localeFromAcceptLanguage(
  header: string | null | undefined
): Locale {
  const languages = (header ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim().split(/[-_]/)[0].toLowerCase())
    .filter(Boolean);

  if (languages.includes("ko")) return "ko";
  if (languages.includes("en")) return "en";
  return DEFAULT_LOCALE;
}

/**
 * 위 판정이 en 이 되는 헤더를 고르는 정규식. 랜딩 홈의 첫 방문 이동(`next.config.ts` redirects 의 `has`)이 쓴다 —
 * 홈은 정적 페이지라 요청 헤더를 직접 읽을 수 없다.
 *
 * Next 는 이 값을 `^…$` 로 감싸 대소문자를 가리는 JS 정규식으로 맞춘다
 * (`next/dist/shared/lib/router/utils/prepare-destination.js` 의 `matchHas`). 그래서 앵커를 넣지 않고 대소문자를 직접 쓴다.
 * 판정 함수와 갈라지지 않게 `accept-language.test.ts` 가 같은 표본으로 둘을 대조한다.
 */
export const ACCEPT_LANGUAGE_EN_ONLY =
  "(?!(?:.*,)?\\s*[kK][oO](?:[-_;,\\s].*)?$)(?:.*,)?\\s*[eE][nN](?:[-_;,\\s].*)?";
