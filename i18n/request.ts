import { lang } from "next/root-params";
import { getRequestConfig } from "next-intl/server";

import { messagesFor } from "@/i18n/messages";
import { productLocale } from "@/lib/i18n/current";
import { isLocale } from "@/lib/i18n/locales";

/**
 * 요청의 언어. 호출부가 언어를 직접 넘기면(`global-not-found`) 그것을, 마케팅 루트(`app/[lang]`)는 root param 을 쓴다.
 * 제품 루트는 `lang()` 이 `undefined` 이므로 계정 → 쿠키 → 브라우저 언어 → ko 로 정한다(`productLocale`, APP-1285).
 * 제품 루트 레이아웃도 같은 함수를 불러 `<html lang>`·클라이언트 메시지와 어긋나지 않는다.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const fromRoot = isLocale(requested) ? requested : await lang();
  const locale = isLocale(fromRoot) ? fromRoot : await productLocale();

  return { locale, messages: messagesFor(locale), timeZone: "Asia/Seoul" };
});
