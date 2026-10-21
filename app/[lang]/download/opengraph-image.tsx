import { getTranslations } from "next-intl/server";

import { helpOgImage, helpOgSize } from "@/lib/help/og";
import { isLocale } from "@/lib/i18n/locales";

export const dynamic = "force-static";
// alt 는 언어마다 달라 페이지 metadata(`download/page.tsx` 의 `openGraph.images`)가 단다.
export const size = helpOgSize;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getTranslations({
    locale: isLocale(lang) ? lang : "ko",
    namespace: "download.og",
  });
  return helpOgImage(t("title"), t("summary"), t("label"));
}
