import { describe, expect, it } from "vitest";

import { nextMonthlyChargeAt } from "@/lib/billing/next-charge";
import { paymentStatusOf } from "@/lib/billing/payment-status";
import { planName } from "@/lib/billing/plan-name";
import { createRequestKey } from "@/lib/billing/request-key";
import {
  isPollingView,
  resultOfView,
  setupViewOf,
} from "@/lib/billing/setup-view";
import { nextPollDelay } from "@/lib/billing/use-poll-window";

describe("nextMonthlyChargeAt", () => {
  // server contract 「기간」: anchor 일을 다음 달 말일로 자르고 시각은 그대로(Asia/Seoul).
  it.each([
    ["2026-11-12T14:30:00+09:00", "2026-12-12T05:30:00.000Z"],
    ["2026-01-31T10:00:00+09:00", "2026-02-28T01:00:00.000Z"],
    ["2028-01-31T10:00:00+09:00", "2028-02-29T01:00:00.000Z"],
    ["2026-03-31T00:10:00+09:00", "2026-04-29T15:10:00.000Z"],
    ["2026-12-15T09:00:00+09:00", "2027-01-15T00:00:00.000Z"],
    // UTC 로는 전날이지만 서울로는 1일이다.
    ["2026-10-31T16:00:00Z", "2026-11-30T16:00:00.000Z"],
  ])("%s 에 승인되면 %s", (now, expected) => {
    expect(nextMonthlyChargeAt(new Date(now))).toBe(expected);
  });
});

describe("requestKey", () => {
  it("renew 하기 전에는 같은 키이고 renew 하면 새 키다", () => {
    const key = createRequestKey();
    const first = key.current();
    expect(key.current()).toBe(first);
    key.renew();
    expect(key.current()).not.toBe(first);
  });
});

describe("setupViewOf", () => {
  it.each([
    ["CARD_AUTH_REQUIRED", "WAITING", "cardAuthRequired"],
    ["AUTH_CAPTURED", "WAITING", "authCaptured"],
    ["BILLING_KEY", "PROCESSING", "cardProcessing"],
    ["BILLING_KEY", "UNKNOWN", "cardUnknown"],
    ["BILLING_KEY", "ACTION_REQUIRED", "cardActionRequired"],
    ["PAYMENT", "PROCESSING", "paymentProcessing"],
    ["PAYMENT", "UNKNOWN", "paymentUnknown"],
    ["PAYMENT", "DECLINED", "declined"],
    ["ACCESS", "PROCESSING", "accessProcessing"],
    ["ACCESS", "CANCELED", "refunded"],
    ["ACCESS", "ACTION_REQUIRED", "accessActionRequired"],
    ["COMPLETED", "COMPLETED", "completed"],
    ["ACCESS_LOST", "ACTION_REQUIRED", "accessLost"],
    ["CLOSED", "CANCELED", "closed"],
    ["AUTH_CAPTURED", "EXPIRED", "closed"],
  ] as const)("%s / %s → %s", (stage, status, view) => {
    expect(setupViewOf({ stage, status })).toBe(view);
  });

  it("승인 뒤 자동 취소가 걸리면 권한 반영 중이 아니라 취소 중으로 보이고 계속 다시 읽는다", () => {
    const attempt = {
      attemptId: "A1",
      cycleId: "C1",
      attemptNumber: 1,
      status: "SUCCEEDED",
      errorCode: null,
      requiresManualReview: false,
      refundStatus: "PROCESSING",
      refundOrigin: "COMPENSATION",
    } as const;
    for (const status of ["PROCESSING", "UNKNOWN"] as const) {
      expect(
        setupViewOf({ stage: "ACCESS", status, originAttempt: attempt })
      ).toBe("refundProcessing");
    }
    expect(isPollingView("refundProcessing")).toBe(true);
    expect(isPollingView("refunded")).toBe(false);
    expect(resultOfView("refunded")).toBe("refunded");
  });

  it("결과 확인 지연은 분석에서 unknown 이고 계속 다시 읽는다", () => {
    expect(resultOfView("paymentUnknown")).toBe("unknown");
    expect(resultOfView("cardUnknown")).toBe("unknown");
    expect(resultOfView("paymentProcessing")).toBeNull();
    expect(isPollingView("paymentUnknown")).toBe(true);
    expect(isPollingView("declined")).toBe(false);
  });
});

describe("nextPollDelay", () => {
  it("서버 간격이 우선이고 없으면 2초 뒤 5초다", () => {
    expect(nextPollDelay(7, 1)).toBe(7000);
    expect(nextPollDelay(null, 1)).toBe(2000);
    expect(nextPollDelay(undefined, 2)).toBe(5000);
  });
});

describe("planName", () => {
  it("FREE·PRO 는 이름으로, 모르는 코드는 코드 그대로 보인다", () => {
    expect(planName("FREE")).toBe("Free");
    expect(planName("PRO")).toBe("Pro");
    expect(planName("TEST_MONTHLY")).toBe("TEST_MONTHLY");
  });
});

describe("paymentStatusOf", () => {
  it("환불이 걸리면 결제 결과보다 환불 상태가 앞서고, 결과를 모르면 확인 중이다", () => {
    expect(paymentStatusOf({ status: "SUCCEEDED", refundStatus: null })).toBe(
      "SUCCEEDED"
    );
    expect(
      paymentStatusOf({ status: "SUCCEEDED", refundStatus: "PROCESSING" })
    ).toBe("REFUNDING");
    expect(
      paymentStatusOf({ status: "SUCCEEDED", refundStatus: "SUCCEEDED" })
    ).toBe("REFUNDED");
    expect(
      paymentStatusOf({ status: "SUCCEEDED", refundStatus: "FAILED" })
    ).toBe("REFUND_FAILED");
    expect(paymentStatusOf({ status: "FAILED", refundStatus: null })).toBe(
      "FAILED"
    );
    expect(paymentStatusOf({ status: "UNKNOWN", refundStatus: null })).toBe(
      "CHECKING"
    );
  });
});
