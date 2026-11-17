import type { Metadata } from "next";

import { messagesFor } from "@/i18n/messages";
import { siteMetadataFor } from "@/lib/site";

import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "./locales";

export function localeAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((each) => [each, localePath(each, path)])),
    "x-default": localePath(DEFAULT_LOCALE, path),
  };
}

export function localizedMetadata(
  locale: Locale,
  path: string,
  share?: { title: string; description: string }
): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  const canonical = localePath(locale, path);
  const site = siteMetadataFor(locale);
  const card = share && {
    title: `${share.title} | ${messagesFor(locale).landing.meta.brandLabel}`,
    description: share.description,
  };

  return {
    alternates: { canonical, languages: localeAlternates(path) },
    openGraph: { ...site.openGraph, url: canonical, ...card },
    twitter: { ...site.twitter, ...card },
  };
}
