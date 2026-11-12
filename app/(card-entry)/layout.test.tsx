import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/current", () => ({ productLocale: async () => "ko" }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUserForSsr: async () => null }));

import CardEntryRootLayout, { generateMetadata } from "@/app/(card-entry)/layout";
import { SiteAnalytics } from "@/components/analytics/site-analytics";
import { AppShell } from "@/components/layout/app-shell";

/** 서버 컴포넌트가 돌려준 트리에서 그 컴포넌트가 그려지는지 찾는다. */
function contains(node: ReactNode, type: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => contains(child, type));
  if (!isValidElement(node)) return false;
  const element = node as ReactElement<{ children?: ReactNode }>;
  return element.type === type || contains(element.props.children, type);
}

// 카드 번호를 받는 면이다(APP-1600). 제3자 분석 스크립트(GA·PostHog·Vercel)를 싣지 않는다.
describe("카드 입력 루트 레이아웃", () => {
  it("셸을 분석 없이 세우고, 그 셸에는 SiteAnalytics 가 없다", async () => {
    const layout = (await CardEntryRootLayout({ children: null })) as ReactElement<{
      analytics?: boolean;
    }>;
    expect(layout.type).toBe(AppShell);
    expect(layout.props.analytics).toBe(false);

    const shell = await AppShell({ locale: "ko", analytics: false, children: null });
    expect(contains(shell, SiteAnalytics)).toBe(false);
    // 같은 검사가 켜진 셸에서는 찾는다 — 찾는 방법이 맞다는 확인.
    const product = await AppShell({ locale: "ko", children: null });
    expect(contains(product, SiteAnalytics)).toBe(true);
  });

  it("noindex 이고 referrer 를 보내지 않는다", async () => {
    const metadata = await generateMetadata();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });
});
