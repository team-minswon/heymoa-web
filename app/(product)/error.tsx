"use client";

import { useLocale } from "next-intl";

import { ErrorView } from "@/components/layout/error-view";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

/** 제품 면 오류 경계. 루트 레이아웃 안이라 Provider 가 있고, 언어는 제품 루트가 정한 값이다(APP-1285). */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  return (
    <ErrorView
      locale={isLocale(locale) ? locale : DEFAULT_LOCALE}
      reset={reset}
    />
  );
}
