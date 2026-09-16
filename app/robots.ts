import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // 🔴 **여기서 `Disallow: /` 로 막지 않습니다.** 비운영 배포를 검색에서 빼는 것은
    //    `app/layout.tsx` 의 `noindex` 이고, 크롤러가 그 지시를 읽으려면 페이지를 **가져올
    //    수 있어야** 합니다. 크롤링을 막으면 이미 알려진 URL 이 색인에 그대로 남습니다.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/callback", "/settings"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
