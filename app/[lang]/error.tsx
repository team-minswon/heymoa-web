"use client";

import { useParams } from "next/navigation";

import { ErrorView } from "@/components/layout/error-view";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export default function MarketingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useParams<{ lang: string }>();
  return <ErrorView locale={isLocale(lang) ? lang : DEFAULT_LOCALE} reset={reset} />;
}
