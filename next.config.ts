import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // **루트를 못박는다.** 워크트리(`.worktrees/app-N`)에서 빌드하면 Next가 부모 레포의
  // 락파일을 보고 워크스페이스 루트를 위로 잡아, 폰트 같은 내부 모듈 해석이 깨지고
  // 산출물 경로가 `.worktrees/` 아래로 한 겹 더 들어간다.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
  experimental: {
    // 매치 안 되는 URL을 `app/global-not-found.tsx`가 받는다. 없으면 그 URL들이 루트
    // 레이아웃을 거쳐 렌더되어, 아무 경로마다 SSR 유저 조회가 실서버로 나간다.
    // experimental이므로 Next를 올릴 때 이 플래그가 살아 있는지 확인한다. (APP-224)
    globalNotFound: true,
  },
};

export default nextConfig;
