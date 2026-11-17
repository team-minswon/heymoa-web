"use client";

import { useLocale } from "next-intl";

import { ErrorView } from "@/components/layout/error-view";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

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
