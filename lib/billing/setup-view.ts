import type {
  BillingCardChangeResult,
  BillingSetupResult,
} from "@/lib/analytics/track";
import {
  BillingSetupStatusResponseDataStatus,
  type BillingSetupStatusResponseData,
} from "@/lib/api/generated/models";

export type SetupView =
  | "cardAuthRequired"
  | "cardProcessing"
  | "cardActionRequired"
  | "paymentProcessing"
  | "paymentUnknown"
  | "declined"
  | "accessProcessing"
  | "refundProcessing"
  | "refunded"
  | "accessActionRequired"
  | "completed"
  | "accessLost"
  | "issueUnknown"
  | "closed";

const KNOWN: Record<string, Record<string, SetupView | "access">> = {
  CARD_AUTH_REQUIRED: { WAITING: "cardAuthRequired" },
  BILLING_KEY: {
    PROCESSING: "cardProcessing",
    UNKNOWN: "issueUnknown",
    DECLINED: "cardActionRequired",
  },
  PAYMENT: {
    PROCESSING: "paymentProcessing",
    UNKNOWN: "paymentUnknown",
    DECLINED: "declined",
  },
  ACCESS: {
    PROCESSING: "access",
    UNKNOWN: "access",
    CANCELED: "refunded",
    ACTION_REQUIRED: "accessActionRequired",
  },
  COMPLETED: { COMPLETED: "completed" },
  CLOSED: { CANCELED: "closed", EXPIRED: "closed" },
};
const KNOWN_STATUS = new Set<string>(
  Object.values(BillingSetupStatusResponseDataStatus)
);

export function setupViewOf(
  setup: Pick<BillingSetupStatusResponseData, "stage" | "status"> &
    Partial<
      Pick<BillingSetupStatusResponseData, "originAttempt" | "latestAttempt">
    >
): SetupView {
  const { stage, status } = setup;
  if (stage === "ACCESS_LOST")
    return KNOWN_STATUS.has(status) ? "accessLost" : "paymentUnknown";
  // 원형의 키(`toString` 등)를 조합으로 읽지 않습니다.
  const byStage = Object.hasOwn(KNOWN, stage) ? KNOWN[stage] : undefined;
  const view =
    byStage && Object.hasOwn(byStage, status) ? byStage[status] : undefined;
  if (!view) return "paymentUnknown";
  if (view !== "access") return view;
  const refund =
    setup.originAttempt?.refundStatus ?? setup.latestAttempt?.refundStatus;
  return refund ? "refundProcessing" : "accessProcessing";
}

const POLLING = new Set<SetupView>([
  "cardProcessing",
  "paymentProcessing",
  "paymentUnknown",
  "accessProcessing",
  "refundProcessing",
]);
export const NOT_PROCESSED_CODE = "NET_CANCEL_NOT_FOUND";

export const isPollingView = (view: SetupView) => POLLING.has(view);

export function resultOfView(view: SetupView): BillingSetupResult | null {
  if (view === "completed") return "completed";
  if (view === "declined") return "declined";
  if (view === "paymentUnknown" || view === "issueUnknown") return "unknown";
  if (view === "refunded") return "refunded";
  return null;
}

export function cardChangeResultOfView(
  view: SetupView
): BillingCardChangeResult | null {
  if (view === "completed") return "completed";
  if (view === "cardActionRequired" || view === "declined") return "declined";
  if (view === "paymentUnknown" || view === "issueUnknown") return "unknown";
  return null;
}
