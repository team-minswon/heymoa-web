import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/current", () => ({ productLocale: async () => "ko" }));
vi.mock("@/lib/auth/server", () => ({
  getCurrentUserForSsr: async () => null,
}));

import CardEntryRootLayout, {
  generateMetadata,
} from "@/app/(card-entry)/layout";
import { SiteAnalytics } from "@/components/analytics/site-analytics";
import { AppShell } from "@/components/layout/app-shell";
import { isChromelessRoute, isFocusChromeRoute } from "@/lib/routes/app-route";

function contains(node: ReactNode, type: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => contains(child, type));
  if (!isValidElement(node)) return false;
  const element = node as ReactElement<{ children?: ReactNode }>;
  return element.type === type || contains(element.props.children, type);
}

describe("카드 입력 루트 레이아웃", () => {
  it("셸을 분석 없이 세우고, 그 셸에는 SiteAnalytics 가 없다", async () => {
    const layout = (await CardEntryRootLayout({
      children: null,
    })) as ReactElement<{
      analytics?: boolean;
    }>;
    expect(layout.type).toBe(AppShell);
    expect(layout.props.analytics).toBe(false);

    const shell = await AppShell({
      locale: "ko",
      analytics: false,
      children: null,
    });
    expect(contains(shell, SiteAnalytics)).toBe(false);
    const product = await AppShell({ locale: "ko", children: null });
    expect(contains(product, SiteAnalytics)).toBe(true);
  });

  it("noindex 이고 referrer 를 보내지 않는다", async () => {
    const metadata = await generateMetadata();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("결제 페이지·카드 변경 iframe 은 머리글·발을 앱이 세우지 않는다", () => {
    expect(isChromelessRoute("/billing/checkout/01K0000000001")).toBe(true);
    expect(isChromelessRoute("/billing/card-change/01K0000000001")).toBe(true);
    expect(isFocusChromeRoute("/billing/setups/01K0000000001")).toBe(true);
  });
});
