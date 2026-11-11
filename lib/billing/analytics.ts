import { type BillingProvider, track } from "@/lib/analytics/track";

/**
 * 결제 흐름 이벤트의 호출 자리(PRO-75). 속성은 공간·PG·결과 상태뿐이다 — authKey·state·카드 정보·결제 식별자는
 * 이 함수들의 인자에도 없다. 이벤트 정의와 근거는 `lib/analytics/track.ts`.
 *
 * 호출 자리: `plansViewed`(요금제 화면 진입)·`checkoutEntered`(주문서 진입)·`agreementAccepted`(동의 체크)·`cardSetupStarted`
 * (등록을 열고 이동 직전)·`cardSetupResulted`(등록 결과 화면, 결과가 처음 보일 때 1회)·`retryClicked`(다시 결제 클릭)·`quotaBlocked`·`quotaUpgradeClicked`(무료 한도로 녹음 시작이 거절된 안내 노출·거기서 요금제 보기 클릭).
 */
export const billingEvents = {
  plansViewed: (workspaceId: string) =>
    track("billing_plans_viewed", { workspace_id: workspaceId }),
  checkoutEntered: (workspaceId: string) =>
    track("billing_checkout_entered", { workspace_id: workspaceId }),
  agreementAccepted: (workspaceId: string) =>
    track("billing_agreement_accepted", { workspace_id: workspaceId }),
  cardSetupStarted: (workspaceId: string, provider: BillingProvider) =>
    track("billing_card_setup_started", {
      workspace_id: workspaceId,
      provider,
    }),
  cardSetupResulted: (
    properties: Parameters<typeof track<"billing_card_setup_resulted">>[1]
  ) => track("billing_card_setup_resulted", properties),
  quotaBlocked: (workspaceId: string, role: "admin" | "member") =>
    track("recording_quota_blocked", { workspace_id: workspaceId, role }),
  quotaUpgradeClicked: (workspaceId: string) =>
    track("recording_quota_upgrade_clicked", { workspace_id: workspaceId }),
  retryClicked: (
    properties: Parameters<typeof track<"billing_retry_clicked">>[1]
  ) => track("billing_retry_clicked", properties),
};
