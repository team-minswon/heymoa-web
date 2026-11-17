import type { BillingPaymentResponseData } from "@/lib/api/generated/models";

type PaymentStatusKey =
  | "SUCCEEDED"
  | "FAILED"
  | "CHECKING"
  | "REFUNDED"
  | "REFUNDING"
  | "REFUND_FAILED";

export function paymentStatusOf(
  payment: Pick<BillingPaymentResponseData, "status" | "refundStatus">
): PaymentStatusKey {
  if (payment.refundStatus === "SUCCEEDED") return "REFUNDED";
  if (payment.refundStatus === "FAILED") return "REFUND_FAILED";
  if (payment.refundStatus) return "REFUNDING";
  if (payment.status === "SUCCEEDED") return "SUCCEEDED";
  if (payment.status === "FAILED") return "FAILED";
  return "CHECKING";
}

export const refundPending = (status: string | null | undefined) =>
  status === "PENDING" || status === "PROCESSING" || status === "UNKNOWN";
