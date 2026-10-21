import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // 🔴 **여기서 `Disallow: /` 로 막지 않습니다.** 비운영 배포를 검색에서 빼는 것은
    //    루트 레이아웃(`lib/site.ts` 의 `siteMetadata`)의 `noindex` 이고, 크롤러가 그 지시를 읽으려면 페이지를 **가져올
    //    수 있어야** 합니다. 크롤링을 막으면 이미 알려진 URL 이 색인에 그대로 남습니다.
    rules: {
      userAgent: "*",
      allow: "/",
      // 제품 면(`/w/**` · `/oauth/**` · `/invite` · `/auth/callback` · `/settings/**`)도 여기서 막지 않는다 — 막으면 그
      // 라우트의 noindex 를 못 읽는다(위 🔴). 색인 제외는 제품 루트 레이아웃(`app/(product)/layout.tsx`)의 기본 noindex 가
      // 맡는다. 크롤링을 막은 URL 은 다른 곳의 링크 때문에 내용 없이 색인에 남을 수 있다(APP-1295).
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
