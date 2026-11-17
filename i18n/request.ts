import { lang } from "next/root-params";
import { getRequestConfig } from "next-intl/server";

import { messagesFor } from "@/i18n/messages";
import { productLocale } from "@/lib/i18n/current";
import { isLocale } from "@/lib/i18n/locales";

export default getRequestConfig(async ({ locale: requested }) => {
  const fromRoot = isLocale(requested) ? requested : await lang();
  const locale = isLocale(fromRoot) ? fromRoot : await productLocale();

  return { locale, messages: messagesFor(locale), timeZone: "Asia/Seoul" };
});
