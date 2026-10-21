"use client";

import type { ReactNode } from "react";

import { SitePageLink } from "@/components/heymoa/site-page-link";
import type { HelpPageId } from "@/app/[lang]/help/_content/ids";
import { helpPathById } from "@/app/[lang]/help/_content/path-by-id";
import { track } from "@/lib/analytics/track";

/**
 * 제품 화면에서 도움말(`/help`)의 그 항목으로 가는 글자 링크. 브라우저에서는 새 탭, 데스크톱 앱에서는 앱 안에서
 * 연다(`SitePageLink`). `topic`은 `app/[lang]/help/_content/topics.tsx`의 주제 slug다.
 */
export function HelpLink({
  topic,
  children = "자세히",
}: {
  topic: HelpPageId;
  children?: ReactNode;
}) {
  return (
    <SitePageLink
      href={helpPathById(topic)}
      onClick={() => track("help_opened", { topic })}
      className="font-medium text-[var(--el-ink)] underline underline-offset-2 hover:text-[var(--el-body)]"
    >
      {children}
    </SitePageLink>
  );
}
