import { BillingCheckoutPage } from "@/components/billing/billing-checkout-page";

import { loginRequired } from "../../../login-gate";

// 첫 구독의 전용 결제 페이지(APP-1600). 분석 없는 루트(`app/(card-entry)`), CSP·프레임 금지는 `proxy.ts`·`next.config.ts`.
export default async function BillingCheckoutRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    (await loginRequired()) ?? <BillingCheckoutPage workspaceId={workspaceId} />
  );
}
