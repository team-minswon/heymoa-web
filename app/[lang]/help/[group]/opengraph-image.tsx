import { helpGroupBySlug } from "@/app/[lang]/help/_content/paths";
import { helpOgImage, helpOgMetadata } from "@/lib/help/og";
import { helpT } from "@/lib/help/i18n";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export const generateImageMetadata = helpOgMetadata;

export default async function Image({
  params,
}: {
  params: Promise<{ lang: string; group: string }>;
}) {
  const { lang, group: slug } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const t = helpT(locale);
  const group = helpGroupBySlug(slug, locale);
  return helpOgImage(
    group?.title ?? t("og.fallbackTitle"),
    group?.summary ?? "",
    t("og.label")
  );
}
