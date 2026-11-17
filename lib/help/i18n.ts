import { createTranslator } from "next-intl";

import { messagesFor } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

export const helpT = (locale: Locale) =>
  createTranslator({
    locale,
    messages: messagesFor(locale),
    namespace: "help",
  });
