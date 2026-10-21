import { helpTopicByPath } from "@/app/[lang]/help/_content/paths";
import { helpOgImage, helpOgMetadata } from "@/lib/help/og";
import { helpT } from "@/lib/help/i18n";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export const generateImageMetadata = helpOgMetadata;

export default async function Image({
  params,
}: {
  params: Promise<{ lang: string; group: string; page: string }>;
}) {
  const { lang, group, page } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const t = helpT(locale);
  const topic = helpTopicByPath(group, page, locale);
  return helpOgImage(
    topic?.title ?? t("og.fallbackTitle"),
    topic?.summary ?? "",
    t("og.label")
  );
}
