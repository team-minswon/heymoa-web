import { type BillingProvider, track } from "@/lib/analytics/track";

/**
 * 결제 흐름 이벤트의 호출 자리(PRO-75). 속성은 공간·PG·결과 상태뿐이다 — authKey·state·카드 정보·결제 식별자는
 * 이 함수들의 인자에도 없다. 이벤트 정의와 근거는 `lib/analytics/track.ts`.
 *
 * 지금 화면이 부르는 것은 `plansViewed`·`checkoutEntered` 뿐이다. 나머지는 API 가 붙는 다음 묶음이 부른다.
 */
export const billingEvents = {
  plansViewed: (workspaceId: string) =>
    track("billing_plans_viewed", { workspace_id: workspaceId }),
  checkoutEntered: (workspaceId: string) =>
    track("billing_checkout_entered", { workspace_id: workspaceId }),
  agreementAccepted: (workspaceId: string) =>
    track("billing_agreement_accepted", { workspace_id: workspaceId }),
  cardSetupStarted: (
    workspaceId: string,
    provider: BillingProvider
  ) =>
    track("billing_card_setup_started", {
      workspace_id: workspaceId,
      provider,
    }),
  cardSetupResulted: (
    properties: Parameters<typeof track<"billing_card_setup_resulted">>[1]
  ) => track("billing_card_setup_resulted", properties),
  retryClicked: (
    properties: Parameters<typeof track<"billing_retry_clicked">>[1]
  ) => track("billing_retry_clicked", properties),
};
