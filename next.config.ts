import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import {
  marketingRedirects,
  marketingRewrites,
} from "./lib/i18n/marketing-routes";

const nextConfig: NextConfig = {
  // 루트를 못박습니다. 워크트리에서 빌드하면 Next 가 부모 레포의 락파일을 보고 루트를 위로 잡아 모듈 해석이 깨집니다.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
  async redirects() {
    return marketingRedirects();
  },
  async rewrites() {
    return { beforeFiles: [], afterFiles: marketingRewrites(), fallback: [] };
  },
  async headers() {
    return [
      {
        source: "/oauth/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/billing/checkout/:workspaceId",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/billing/card-change/:workspaceId",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/unsubscribe",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  experimental: {
    // 없으면 매치 안 되는 URL 이 루트 레이아웃을 거쳐 SSR 유저 조회를 냅니다. experimental 이라 Next 를 올릴 때 살아 있는지 봅니다.
    globalNotFound: true,
    // Vercel 이 복원한 Turbopack 캐시로 `globals.css` 만 옛 판이 나간 적이 있어 Vercel 에서는 빌드 캐시를 끕니다.
    turbopackFileSystemCacheForBuild: !process.env.VERCEL,
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
