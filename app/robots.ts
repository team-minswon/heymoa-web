import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // `Disallow: /` 로 막지 않습니다. 크롤러가 noindex 를 읽으려면 페이지를 가져올 수 있어야 하고, 막으면 알려진 URL 이 내용 없이 색인에 남습니다.
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
