import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(card-entry)/login-gate", () => ({
  loginRequired: async () => null,
}));
vi.mock("@/lib/workspace/prefetch", () => ({
  prefetchCardEntry: async () => ({ queries: [], mutations: [] }),
}));

import BillingCheckoutRoute from "@/app/(card-entry)/billing/checkout/[workspaceId]/page";

afterEach(() => vi.useRealTimers());

// 첫 구독 주문서의 다음 결제 예정일은 브라우저 시계가 아니라 페이지를 만든 서버 시각으로 계산해 내려 준다(APP-1600).
describe("결제 페이지(서버 컴포넌트)", () => {
  it("서버 시각으로 계산한 다음 결제 예정일을 내려 준다", async () => {
    vi.useFakeTimers({ now: new Date("2026-01-31T10:00:00+09:00") });
    const boundary = (await BillingCheckoutRoute({
      params: Promise.resolve({ workspaceId: "W1" }),
    })) as ReactElement<{ children: ReactElement<Record<string, unknown>> }>;
    expect(boundary.props.children.props).toMatchObject({
      workspaceId: "W1",
      nextChargeAt: "2026-02-28T01:00:00.000Z",
    });
  });
});
