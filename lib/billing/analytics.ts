import { type BillingProvider, track } from "@/lib/analytics/track";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";

/**
 * 결제 흐름 이벤트의 호출 자리(PRO-75). 속성은 공간·PG·결과 상태뿐이다 — authKey·state·카드 정보·결제 식별자는
 * 이 함수들의 인자에도 없다. 이벤트 정의와 근거는 `lib/analytics/track.ts`.
 *
 * 호출 자리: `plansViewed`(요금제 화면 진입)·`checkoutEntered`(주문서 진입)·`agreementAccepted`(동의 체크, 화면당 1회)·`cardSetupStarted`
 * (등록을 열고 이동 직전)·`cardSetupResulted`(등록 결과 화면, 결과가 처음 보일 때 1회)·`quotaBlocked`·`quotaUpgradeClicked`(무료 한도로 녹음 시작이 거절된 안내 노출·거기서 요금제 보기 클릭).
 * 구독 관리(APP-1565): `cancelDialogOpened`·`subscriptionCanceled`(해지 확인 창·해지 완료)·`subscriptionResumed`·`cardChangeStarted`(카드 변경
 * 주문서에서 등록을 열고 이동 직전)·`refundResulted`(취소 처리 중을 본 뒤 끝난 결과)·`paymentMethodDeleted`·`paymentViewed`
 * (결제 상세)·`paymentHistoryViewed`(내 결제 내역). 카드 변경 결과는 구매 퍼널(`cardSetupResulted`)에 섞지 않는다.
 */
export const billingEvents = {
  plansViewed: (workspaceId: string, role: "admin" | "member") =>
    track("billing_plans_viewed", { workspace_id: workspaceId, role }),
  checkoutEntered: (workspaceId: string, role: "admin" | "member") =>
    track("billing_checkout_entered", { workspace_id: workspaceId, role }),
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
  cancelDialogOpened: (workspaceId: string) =>
    track("billing_cancel_dialog_opened", { workspace_id: workspaceId }),
  subscriptionCanceled: (workspaceId: string) =>
    track("billing_subscription_canceled", { workspace_id: workspaceId }),
  subscriptionResumed: (workspaceId: string, result: "resumed" | "not_admin") =>
    track("billing_subscription_resumed", {
      workspace_id: workspaceId,
      result,
    }),
  cardChangeStarted: (workspaceId: string) =>
    track("billing_card_change_started", { workspace_id: workspaceId }),
  refundResulted: (workspaceId: string, result: "succeeded" | "failed") =>
    track("billing_refund_resulted", { workspace_id: workspaceId, result }),
  paymentMethodDeleted: (workspaceId: string, result: "deleted" | "in_use") =>
    track("billing_payment_method_deleted", {
      workspace_id: workspaceId,
      result,
    }),
  paymentViewed: (workspaceId: string) =>
    track("billing_payment_viewed", { workspace_id: workspaceId }),
  paymentHistoryViewed: () => track("billing_payment_history_viewed", {}),
};

/**
 * 화면 조회 이벤트에 실을 역할. 공간 조회는 레이아웃이 미리 읽어 두어 첫 렌더에 있다. 역할을 모르는 동안은 undefined 라
 * 이벤트를 미루고, 공간 조회가 끝내 실패하면 그 조회는 세지 않는다(화면도 그려지지 않는다).
 */
export function useBillingViewerRole(workspaceId: string) {
  const role = okData(useGetWorkspace(workspaceId).data)?.role;
  if (!role) return undefined;
  return role === "ADMIN" ? "admin" : "member";
}
