import type {
  BillingCardChangeResult,
  BillingSetupResult,
} from "@/lib/analytics/track";
import {
  BillingSetupStatusResponseDataStatus,
  type BillingSetupStatusResponseData,
} from "@/lib/api/generated/models";

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

/**
 * 서버(`BillingSetupViewHandler`)가 실제로 주는 (stage, status) 조합만 화면으로 보낸다. 표에 없는 stage·status(서버가 새 값을
 * 더했는데 web 이 아직 모르는 경우)는 성공·거절·재구매로 읽지 않고 「확인 중」(`paymentUnknown`)으로 보낸다.
 * `ACCESS_LOST` 는 status 에 원래 상태를 그대로 실어 와서 아는 status 이면 다 받는다.
 */
const KNOWN: Record<string, Record<string, SetupView | "access">> = {
  CARD_AUTH_REQUIRED: { WAITING: "cardAuthRequired" },
  // 발급 거절(ISSUE_REJECTED)은 DECLINED, 발급 응답을 잃은 것(ISSUE_UNKNOWN)은 UNKNOWN — 서버가 다시 보내지 않으니 결제는 없었다.
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
  // 승인은 됐지만 권한 대신 자동 취소가 걸린 결제(보상 환불). 「닫힘」·「권한 반영 중」으로 읽히면 안 된다.
  ACCESS: {
    PROCESSING: "access",
    UNKNOWN: "access",
    CANCELED: "refunded",
    ACTION_REQUIRED: "accessActionRequired",
  },
  COMPLETED: { COMPLETED: "completed" },
  // 서버는 CANCELED·EXPIRED 를 CLOSED 단계로만 준다(ACCESS / CANCELED 는 위에서 갈랐다).
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
  // 원형의 키(`toString` 등)를 조합으로 읽지 않는다.
  const byStage = Object.hasOwn(KNOWN, stage) ? KNOWN[stage] : undefined;
  const view =
    byStage && Object.hasOwn(byStage, status) ? byStage[status] : undefined;
  if (!view) return "paymentUnknown";
  if (view !== "access") return view;
  const refund =
    setup.originAttempt?.refundStatus ?? setup.latestAttempt?.refundStatus;
  return refund ? "refundProcessing" : "accessProcessing";
}

/** 서버가 아직 일하는 중이라 다시 읽을 가치가 있는 상태. 나머지는 사람이 움직여야 바뀐다. */
const POLLING = new Set<SetupView>([
  "cardProcessing",
  "paymentProcessing",
  "paymentUnknown",
  "accessProcessing",
  "refundProcessing",
]);
/**
 * 서버가 「조회도 망취소도 거래 없음」으로 닫은 첫 구매의 코드(APP-1600). 카드사 거절이 아니라 결제 요청이 처리되지 않은 것이라
 * 거절 화면에 「카드사에서 거절」 대신 「처리되지 않았습니다」를 보인다.
 */
export const NOT_PROCESSED_CODE = "NET_CANCEL_NOT_FOUND";

export const isPollingView = (view: SetupView) => POLLING.has(view);

/** 분석 이벤트로 낼 최종 상태. 진행 중이거나 사람이 움직여야 하는 상태는 null. */
export function resultOfView(view: SetupView): BillingSetupResult | null {
  if (view === "completed") return "completed";
  if (view === "declined") return "declined";
  if (view === "paymentUnknown" || view === "issueUnknown") return "unknown";
  if (view === "refunded") return "refunded";
  return null;
}

/** 카드 변경(REPLACE) 결과 이벤트로 낼 최종 상태. 카드 변경의 발급 거절은 `cardActionRequired` 화면이다. */
export function cardChangeResultOfView(
  view: SetupView
): BillingCardChangeResult | null {
  if (view === "completed") return "completed";
  if (view === "cardActionRequired") return "declined";
  if (view === "paymentUnknown" || view === "issueUnknown") return "unknown";
  return null;
}
