import { helpOgImage, helpOgMetadata, type HelpOgProps } from "@/lib/help/og";
import { helpT } from "@/lib/help/i18n";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export const generateImageMetadata = helpOgMetadata;

export default async function Image({ params }: HelpOgProps) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const t = helpT(locale);
  return helpOgImage(t("guide"), t("og.hubSummary"), t("og.label"));
}
