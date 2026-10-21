import { lang } from "next/root-params";
import { getRequestConfig } from "next-intl/server";

import { messagesFor } from "@/i18n/messages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

/**
 * 요청의 언어. 마케팅 루트(`app/[lang]`)는 root param 이 정하고, 제품 루트는 `lang()` 이 `undefined` 라
 * 한국어다(제품 면 언어 결정은 PRO-66-I07). 호출부가 언어를 직접 넘기면(`global-not-found`) 그것을 쓴다.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const fromRoot = isLocale(requested) ? requested : await lang();
  const locale = isLocale(fromRoot) ? fromRoot : DEFAULT_LOCALE;

  return { locale, messages: messagesFor(locale), timeZone: "Asia/Seoul" };
});
