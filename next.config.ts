import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 매치 안 되는 URL을 `app/global-not-found.tsx`가 받는다. 없으면 그 URL들이 루트
    // 레이아웃을 거쳐 렌더되어, 아무 경로마다 SSR 유저 조회가 실서버로 나간다.
    // experimental이므로 Next를 올릴 때 이 플래그가 살아 있는지 확인한다. (APP-224)
    globalNotFound: true,
  },
};

export default nextConfig;
