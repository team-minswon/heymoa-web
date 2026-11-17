import { DEFAULT_LOCALE, type Locale } from "./locales";

// next.config.ts 와 클라이언트가 같이 읽으므로 Next 서버 API 를 들이지 않습니다.
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

// Next 는 이 값을 `^…$` 로 감싸 대소문자를 가리는 정규식으로 맞춥니다(matchHas). 그래서 앵커 없이 대소문자를 직접 씁니다.
export const ACCEPT_LANGUAGE_EN_ONLY =
  "(?!(?:.*,)?\\s*[kK][oO](?:[-_;,\\s].*)?$)(?:.*,)?\\s*[eE][nN](?:[-_;,\\s].*)?";
