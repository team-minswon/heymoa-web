/**
 * 옛 결제 주소(PRO-75 전의 전용 화면)는 설정 창의 그 탭으로 보낸다. 메일·북마크·결제 대행사 복귀가 이 주소를 들고 올 수 있다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import BillingRoute from "./page";
import CardRoute from "./card/page";
import CheckoutRoute from "./checkout/page";
import PaymentRoute from "./payments/[paymentId]/page";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

const W = "01K0000000006";
const params = <T extends object>(value: T) => Promise.resolve(value);

describe("옛 결제 주소", () => {
  beforeEach(() => redirect.mockClear());

  it.each([
    {
      path: "/w/{id}/billing",
      route: () => BillingRoute({ params: params({ workspaceId: W }) }),
      section: "billing",
    },
    {
      path: "/w/{id}/billing/card",
      route: () => CardRoute({ params: params({ workspaceId: W }) }),
      section: "payment",
    },
    {
      path: "/w/{id}/billing/payments/{paymentId}",
      route: () =>
        PaymentRoute({ params: params({ workspaceId: W, paymentId: "0P1" }) }),
      section: "payment",
    },
  ])(
    "$path 는 설정 창의 $section 탭으로 보낸다",
    async ({ route, section }) => {
      await route();
      expect(redirect).toHaveBeenCalledTimes(1);
      expect(redirect).toHaveBeenCalledWith(`/w/${W}?settings=${section}`);
    }
  );

  it("옛 주문서 주소는 첫 구독 결제 페이지로 보낸다", async () => {
    await CheckoutRoute({ params: params({ workspaceId: W }) });
    expect(redirect).toHaveBeenCalledWith(`/billing/checkout/${W}`);
  });
});
