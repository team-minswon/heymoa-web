import { track } from "@/lib/analytics/track";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";

/**
 * 결제 흐름 이벤트의 호출 자리(PRO-75). 속성은 공간·PG·결과 상태뿐이다 — authKey·state·카드 정보·결제 식별자는
 * 이 함수들의 인자에도 없다. 이벤트 정의와 근거는 `lib/analytics/track.ts`. 카드를 받는 문서(결제 페이지·카드 변경 iframe)에는 분석
 * 스크립트가 없어 거기서는 이벤트를 내지 않는다(APP-1600) — 동의 체크·카드 제출은 세지 않는다.
 *
 * 호출 자리: `plansViewed`(요금제 화면 진입)·`checkoutEntered`(요금제 탭에서 결제 페이지로 떠나기 직전)·`cardSetupResulted`(등록 결과 화면, 결과가 처음 보일 때 1회)·`quotaBlocked`·`quotaUpgradeClicked`(무료 한도로 녹음 시작이 거절된 안내 노출·거기서 요금제 보기 클릭).
 * 구독 관리(APP-1565): `cancelDialogOpened`·`subscriptionCanceled`(해지 확인 창·해지 완료)·`subscriptionResumed`·`cardChangeStarted`(카드 변경
 * 모달을 열 때)·`paymentMethodDeleted`·`paymentViewed`(결제 상세)·`paymentHistoryViewed`(공간의 결제 내역·내 결제 내역).
 * 환불 결과는 서버가 환불 사건으로 따로 낸다. 카드 변경 결과는 구매 퍼널(`cardSetupResulted`)에 섞지 않고 `cardChangeResulted` 로 낸다.
 * 결과 화면의 버튼(`setupResultActionClicked`)·판매 중단 안내 노출(`salesUnavailableViewed`)·영수증 링크(`receiptClicked`).
 */
export const billingEvents = {
  plansViewed: (workspaceId: string, role: "admin" | "member") =>
    track("billing_plans_viewed", { workspace_id: workspaceId, role }),
  checkoutEntered: (workspaceId: string, role: "admin" | "member") =>
    track("billing_checkout_entered", { workspace_id: workspaceId, role }),
  cardSetupResulted: (
    properties: Parameters<typeof track<"billing_card_setup_resulted">>[1]
  ) => track("billing_card_setup_resulted", properties),
  cardChangeResulted: (
    properties: Parameters<typeof track<"billing_card_change_resulted">>[1]
  ) => track("billing_card_change_resulted", properties),
  setupResultActionClicked: (
    properties: Parameters<
      typeof track<"billing_setup_result_action_clicked">
    >[1]
  ) => track("billing_setup_result_action_clicked", properties),
  salesUnavailableViewed: (workspaceId: string, role: "admin" | "member") =>
    track("billing_sales_unavailable_viewed", {
      workspace_id: workspaceId,
      role,
    }),
  receiptClicked: (workspaceId?: string) =>
    track(
      "billing_receipt_clicked",
      workspaceId ? { workspace_id: workspaceId } : {}
    ),
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
  paymentMethodDeleted: (workspaceId: string, result: "deleted" | "in_use") =>
    track("billing_payment_method_deleted", {
      workspace_id: workspaceId,
      result,
    }),
  paymentViewed: (workspaceId: string) =>
    track("billing_payment_viewed", { workspace_id: workspaceId }),
  paymentHistoryViewed: (scope: "workspace" | "me") =>
    track("billing_payment_history_viewed", { scope }),
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
