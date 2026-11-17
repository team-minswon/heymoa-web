import { track } from "@/lib/analytics/track";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";

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

export function useBillingViewerRole(workspaceId: string) {
  const role = okData(useGetWorkspace(workspaceId).data)?.role;
  if (!role) return undefined;
  return role === "ADMIN" ? "admin" : "member";
}
