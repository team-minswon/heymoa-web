"use client";

import type { ReactNode } from "react";

import { SitePageLink } from "@/components/heymoa/site-page-link";
import { track } from "@/lib/analytics/track";

/**
 * 제품 화면에서 도움말(`/help`)의 그 항목으로 가는 글자 링크. 브라우저에서는 새 탭, 데스크톱 앱에서는 앱 안에서
 * 연다(`SitePageLink`). `topic`은 `app/(static)/help/page.tsx`의 조항 id다.
 */
export function HelpLink({
  topic,
  children = "자세히",
}: {
  topic: "start" | "recording" | "desktop" | "speakers" | "summary" | "tasks" | "integrations" | "agents" | "trouble";
  children?: ReactNode;
}) {
  return (
    <SitePageLink
      href={`/help#${topic}`}
      onClick={() => track("help_opened", { topic })}
      className="font-medium text-[var(--el-ink)] underline underline-offset-2 hover:text-[var(--el-body)]"
    >
      {children}
    </SitePageLink>
  );
}
