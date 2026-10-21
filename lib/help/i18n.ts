import { createTranslator } from "next-intl";

import { messagesFor } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 서버에서 그리는 가이드(페이지 · 머리말 · 공유 이미지)의 문구. 클라이언트 컴포넌트는 `useTranslations("help")` 를 쓴다.
 * 페이지가 정적이고 언어를 주소(`[lang]`)로 받으므로 언어를 직접 넘긴다.
 */
export const helpT = (locale: Locale) =>
  createTranslator({
    locale,
    messages: messagesFor(locale),
    namespace: "help",
  });
