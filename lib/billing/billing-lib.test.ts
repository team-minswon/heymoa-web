import { describe, expect, it } from "vitest";

import { planName } from "@/lib/billing/plan-name";
import { createRequestKey } from "@/lib/billing/request-key";
import {
  isPollingView,
  resultOfView,
  setupViewOf,
} from "@/lib/billing/setup-view";
import { nextPollDelay } from "@/lib/billing/use-poll-window";

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
    ["COMPLETED", "COMPLETED", "completed"],
    ["ACCESS_LOST", "ACTION_REQUIRED", "accessLost"],
    ["CLOSED", "CANCELED", "closed"],
    ["AUTH_CAPTURED", "EXPIRED", "closed"],
  ] as const)("%s / %s → %s", (stage, status, view) => {
    expect(setupViewOf({ stage, status })).toBe(view);
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
