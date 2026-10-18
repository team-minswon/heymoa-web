import type { MetadataRoute } from "next";

import { helpGroups } from "@/app/(static)/help/_content/groups";
import { helpPathOf } from "@/app/(static)/help/_content/paths";
import { helpTopics } from "@/app/(static)/help/_content/topics";
import { HELP_MODIFIED } from "@/lib/help/dates";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteConfig.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/download`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteConfig.url}/help`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...helpGroups.map((group) => ({
      url: `${siteConfig.url}/help/${group.slug}`,
      lastModified: HELP_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...helpTopics.map((topic) => ({
      url: `${siteConfig.url}${helpPathOf(topic)}`,
      lastModified: HELP_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      url: `${siteConfig.url}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteConfig.url}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
