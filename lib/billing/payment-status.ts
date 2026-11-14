import type { BillingPaymentResponseData } from "@/lib/api/generated/models";

/** 결제 한 건이 지금 어떤 상태로 보이는가. 환불이 걸리면 결제 결과보다 환불 상태가 앞선다. 키는 `billing.paymentStatus`. */
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

/** 취소(환불)가 아직 끝나지 않았다 — 화면이 다시 읽을 가치가 있다. */
export const refundPending = (status: string | null | undefined) =>
  status === "PENDING" || status === "PROCESSING" || status === "UNKNOWN";
