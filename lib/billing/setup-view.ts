import type { BillingSetupResult } from "@/lib/analytics/track";
import type { BillingSetupStatusResponseData } from "@/lib/api/generated/models";

/**
 * 카드 등록 결과 화면이 그리는 상태. 서버의 (stage, status) 쌍을 화면 문구 단위로 접은 것이다 — 표는
 * `결제-기능-추가/12-화면과-API-상태-계약.md` 4절. 내부 상태(`setupStatus`)는 보지 않는다.
 */
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

export function setupViewOf(
  setup: Pick<BillingSetupStatusResponseData, "stage" | "status"> &
    Partial<
      Pick<BillingSetupStatusResponseData, "originAttempt" | "latestAttempt">
    >
): SetupView {
  const { stage, status } = setup;
  if (stage === "ACCESS_LOST") return "accessLost";
  if (stage === "COMPLETED") return "completed";
  // 승인은 됐지만 권한 대신 자동 취소가 걸린 결제(보상 환불). 「닫힘」·「권한 반영 중」으로 읽히면 안 된다.
  if (stage === "ACCESS") {
    if (status === "CANCELED") return "refunded";
    if (status === "ACTION_REQUIRED") return "accessActionRequired";
    const refund =
      setup.originAttempt?.refundStatus ?? setup.latestAttempt?.refundStatus;
    return refund ? "refundProcessing" : "accessProcessing";
  }
  // 서버(BillingSetupViewHandler)는 CANCELED·EXPIRED 를 CLOSED 단계로만 준다(ACCESS / CANCELED 는 위에서 갈랐다).
  if (stage === "CLOSED") return "closed";
  if (stage === "CARD_AUTH_REQUIRED") return "cardAuthRequired";
  if (stage === "BILLING_KEY") {
    // 카드 발급 응답을 잃었다(ISSUE_UNKNOWN, APP-1600). 서버가 다시 보내지 않으니 결제는 없었고 새 등록부터 한다.
    if (status === "UNKNOWN") return "issueUnknown";
    // 발급 거절(ISSUE_REJECTED)은 DECLINED 다. 서버는 이 단계에 ACTION_REQUIRED 를 주지 않는다.
    if (status === "DECLINED") return "cardActionRequired";
    return "cardProcessing";
  }
  // PAYMENT
  if (status === "DECLINED") return "declined";
  if (status === "UNKNOWN") return "paymentUnknown";
  return "paymentProcessing";
}

/** 서버가 아직 일하는 중이라 다시 읽을 가치가 있는 상태. 나머지는 사람이 움직여야 바뀐다. */
const POLLING = new Set<SetupView>([
  "cardProcessing",
  "paymentProcessing",
  "paymentUnknown",
  "accessProcessing",
  "refundProcessing",
]);
export const isPollingView = (view: SetupView) => POLLING.has(view);

/** 분석 이벤트로 낼 최종 상태. 진행 중이거나 사람이 움직여야 하는 상태는 null. */
export function resultOfView(view: SetupView): BillingSetupResult | null {
  if (view === "completed") return "completed";
  if (view === "declined") return "declined";
  if (view === "paymentUnknown" || view === "issueUnknown") return "unknown";
  if (view === "refunded") return "refunded";
  return null;
}
