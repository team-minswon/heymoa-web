import type { MetadataRoute } from "next";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import { helpPathOf } from "@/app/[lang]/help/_content/paths";
import { helpTopics } from "@/app/[lang]/help/_content/topics";
import { HELP_MODIFIED } from "@/lib/help/dates";
import { localePath, publishedLocales } from "@/lib/i18n/locales";
import { MARKETING_PAGES } from "@/lib/i18n/marketing-routes";
import { siteConfig } from "@/lib/site";

type Entry = Omit<MetadataRoute.Sitemap[number], "url"> & { path: string };

/** 무접두 경로 하나를 sitemap 에 실을 문서들. 마케팅 경로 목록과 가이드 주제 목록에서 만든다. */
function sitemapPages(): Entry[] {
  const lastModified = new Date();
  return [
    ...MARKETING_PAGES.map(({ path, changeFrequency, priority }) => ({
      path,
      lastModified,
      changeFrequency,
      priority,
    })),
    ...helpGroups.map((group) => ({
      path: `/help/${group.slug}`,
      lastModified: HELP_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...helpTopics.map((topic) => ({
      path: helpPathOf(topic),
      lastModified: HELP_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}

// 랜딩은 끝 슬래시 없이 `https://heymoa.app` 이다(운영 sitemap 그대로).
const absolute = (path: string) =>
  path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;

/** 공개한 언어판만 싣는다(`PUBLISHED_LOCALES`). 항목마다 공개 언어끼리의 대응을 단다. */
export default function sitemap(): MetadataRoute.Sitemap {
  const locales = publishedLocales();
  return sitemapPages().flatMap(({ path, ...entry }) => {
    const languages = Object.fromEntries(
      locales.map((locale) => [locale, absolute(localePath(locale, path))])
    );
    return locales.map((locale) => ({
      ...entry,
      url: absolute(localePath(locale, path)),
      alternates: { languages },
    }));
  });
}
