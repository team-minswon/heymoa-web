import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 컨테이너에서 돌리려고 켠다. `.next/standalone`에 서버와 필요한 node_modules만 담겨
  // 이미지가 작아지고, `node server.js` 하나로 뜬다. 로컬 `pnpm dev`·`pnpm build`는 영향이
  // 없다 — standalone 산출물이 하나 더 생길 뿐이다.
  output: "standalone",
  // **루트를 못박는다.** 워크트리(`.worktrees/app-N`)에서 빌드하면 Next가 부모 레포의
  // 락파일을 보고 워크스페이스 루트를 위로 잡아, standalone 산출물이 `.worktrees/` 아래로
  // 한 겹 더 들어간다. 그러면 `server.js` 경로가 환경마다 달라져 Dockerfile이 깨진다.
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
