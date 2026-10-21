import type { MetadataRoute } from "next";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import { helpPathOf } from "@/app/[lang]/help/_content/paths";
import { helpTopicsFor } from "@/app/[lang]/help/_content/topics";
import { LOCALES, localePath } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/i18n/metadata";
import { MARKETING_PAGES } from "@/lib/i18n/marketing-routes";
import { PAGE_MODIFIED } from "@/lib/page-dates";
import { siteConfig } from "@/lib/site";

// 랜딩은 끝 슬래시 없이 `https://heymoa.app` 이다(운영 sitemap 그대로).
const absolute = (path: string) =>
  path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;

/** `YYYY-MM-DD` 문자열은 사전순이 곧 날짜순이다. */
const newest = (dates: readonly string[]) =>
  dates.reduce((a, b) => (a > b ? a : b));

/**
 * 모든 언어판을 싣고, 항목마다 언어판끼리의 대응(`x-default` 포함)을 단다 — 페이지 head 와 같은 원본이다.
 * `lastmod` 는 배포 시각이 아니라 내용을 고친 날이다(`lib/page-dates.ts`, 가이드는 frontmatter `modified`).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.flatMap((locale) => {
    const topics = helpTopicsFor(locale);
    const entries = [
      ...MARKETING_PAGES.map(({ path, changeFrequency, priority }) => ({
        path,
        // 가이드 허브는 아래 페이지 중 가장 최근에 고친 날이다.
        lastModified:
          path === "/help"
            ? newest(topics.map((topic) => topic.modified))
            : PAGE_MODIFIED[path][locale],
        changeFrequency,
        priority,
      })),
      ...helpGroups.map((group) => ({
        path: `/help/${group.slug}`,
        lastModified: newest(
          topics
            .filter((topic) => topic.group === group.slug)
            .map((topic) => topic.modified)
        ),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
      ...topics.map((topic) => ({
        path: helpPathOf(topic),
        lastModified: topic.modified,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
    return entries.map(({ path, ...entry }) => ({
      ...entry,
      url: absolute(localePath(locale, path)),
      alternates: {
        languages: Object.fromEntries(
          Object.entries(localeAlternates(path)).map(([hreflang, href]) => [
            hreflang,
            absolute(href),
          ])
        ),
      },
    }));
  });
}
