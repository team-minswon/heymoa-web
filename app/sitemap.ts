import type { MetadataRoute } from "next";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import { helpPathOf } from "@/app/[lang]/help/_content/paths";
import { helpTopicsFor } from "@/app/[lang]/help/_content/topics";
import { LOCALES, localePath } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/i18n/metadata";
import { MARKETING_PAGES } from "@/lib/i18n/marketing-routes";
import { PAGE_MODIFIED } from "@/lib/page-dates";
import { siteConfig } from "@/lib/site";

const absolute = (path: string) =>
  path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;

const newest = (dates: readonly string[]) =>
  dates.reduce((a, b) => (a > b ? a : b));

export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.flatMap((locale) => {
    const topics = helpTopicsFor(locale);
    const entries = [
      ...MARKETING_PAGES.map(({ path, changeFrequency, priority }) => ({
        path,
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
