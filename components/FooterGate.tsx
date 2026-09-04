"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { isWorkspaceRoute } from "@/lib/routes/app-route";

/**
 * 푸터를 어디에 세울지만 판다. **어떤 푸터인지는 `Footer`가 경로로 가른다** — 한때 여기서
 * `simplified`를 내려 약관·개인정보에 축약 판을 세웠는데, 랜딩이 크림 편집 조판으로 옮겨간
 * 뒤로 그 축약 판만 제품 면 회색(`--el-canvas`)이라 크림 문서 아래에 회색 띠가 남았다.
 * `DESIGN.md`가 랜딩과 약관을 **같은 마케팅 면**으로 묶으므로 푸터도 같은 것을 쓴다.
 */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 인증 콜백과 워크스페이스 안쪽은 푸터를 아예 안 세운다.
  if (pathname === "/auth/callback" || isWorkspaceRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
