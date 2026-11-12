import { describe, expect, it } from "vitest";

import {
  cardErrors,
  cardRequestOf,
  formatCardNumber,
  formatExpiry,
  luhnValid,
  type CardForm,
} from "@/lib/billing/card-input";
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
import {
  freeUsageLevel,
  isPaidPeriod,
  RECORDING_USAGE_POLL_MS,
  RECORDING_USAGE_QUERY,
} from "@/lib/billing/use-recording-usage";

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
    ["BILLING_KEY", "PROCESSING", "cardProcessing"],
    ["BILLING_KEY", "UNKNOWN", "issueUnknown"],
    ["BILLING_KEY", "DECLINED", "cardActionRequired"],
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
    ["CLOSED", "EXPIRED", "closed"],
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
    expect(resultOfView("issueUnknown")).toBe("unknown");
    // 발급 결과 불명은 서버가 다시 보내지 않아 기다릴 것이 없다(새 등록부터).
    expect(isPollingView("issueUnknown")).toBe(false);
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

describe("freeUsageLevel", () => {
  // 한도 1000분, 남은 샘플은 서버 값(16kHz). 막대는 쓴 만큼 차고, 다 쓰기 전에는 99 를 넘지 않는다.
  const at = (used: number, remainingSamples: number | null) =>
    freeUsageLevel({
      usedMinutes: used,
      allowanceMinutes: 1000,
      remainingMinutes: Math.max(0, 1000 - used),
      remainingSamples,
    });
  it.each([
    ["79.9%", 799, (1000 - 799) * 960000, "ok", 79, 201],
    ["80%", 800, 200 * 960000, "near", 80, 200],
    ["99.9%", 999, 960000, "near", 99, 1],
    ["100%", 1000, 0, "exhausted", 100, 0],
    ["한도 초과", 1100, 0, "exhausted", 100, 0],
    ["분은 한도인데 몇 초 남음", 1000, 16000, "near", 99, 0],
    ["남은 샘플이 없으면 분으로", 1000, null, "exhausted", 100, 0],
  ])("%s", (_name, used, remaining, level, percent, remainingMinutes) => {
    expect(at(used, remaining)).toMatchObject({
      level,
      percent,
      remainingMinutes,
    });
  });

  // 서버는 남은 분을 내림해 준다. 남은 샘플이 있는데 분이 0 이면 1분 미만이 남은 것이다.
  it.each([
    [
      "남은 샘플 0 이면 다 쓴 것이라 1분 미만이 아니다",
      0,
      0,
      "exhausted",
      false,
    ],
    ["1샘플 남으면 1분 미만으로 본다", 1, 0, "near", true],
    ["59초분 남으면 1분 미만으로 본다", 59 * 16000, 0, "near", true],
    ["60초분 남으면 1분으로 본다", 60 * 16000, 1, "near", false],
  ])("%s", (_name, remainingSamples, remainingMinutes, level, underMinute) => {
    expect(
      freeUsageLevel({
        usedMinutes: 1000 - remainingMinutes,
        allowanceMinutes: 1000,
        remainingMinutes,
        remainingSamples,
      })
    ).toMatchObject({ level, remainingMinutes, underMinute });
  });
});

describe("녹음 사용량 조회 설정(APP-1566)", () => {
  const interval = (data: unknown) =>
    RECORDING_USAGE_QUERY.refetchInterval({
      state: {
        data: data
          ? ({ status: 200, data: { success: true, data } } as never)
          : undefined,
      },
    });

  it("창으로 돌아오면 다시 읽고, 창이 가려진 동안은 주기 읽기를 하지 않는다", () => {
    expect(RECORDING_USAGE_QUERY.refetchOnWindowFocus).toBe(true);
    expect(RECORDING_USAGE_QUERY.refetchIntervalInBackground).toBe(false);
  });

  it("집행 대상이면 5분마다 다시 읽는다", () => {
    expect(RECORDING_USAGE_POLL_MS).toBe(300_000);
    expect(interval({ enforced: true })).toBe(300_000);
  });

  it("집행 대상이 아니거나 아직 응답이 없으면 주기 읽기를 끈다", () => {
    expect(interval({ enforced: false })).toBe(false);
    expect(interval(undefined)).toBe(false);
  });
});

describe("isPaidPeriod", () => {
  it("서버의 기간 종류로 유료 기간을 가른다", () => {
    expect(isPaidPeriod({ periodKind: "PAID", unlimited: false })).toBe(true);
    expect(isPaidPeriod({ periodKind: "FREE", unlimited: true })).toBe(false);
  });

  it("기간 종류가 없으면 무제한인지로 가른다", () => {
    expect(isPaidPeriod({ periodKind: null, unlimited: true })).toBe(true);
    expect(isPaidPeriod({ periodKind: null, unlimited: false })).toBe(false);
  });
});

describe("카드 정보 검사(APP-1600)", () => {
  const now = new Date("2026-11-12T12:00:00+09:00");
  const form = (patch: Partial<CardForm> = {}): CardForm => ({
    number: "4111111111111111",
    expiry: "1126",
    password: "12",
    identity: "900101",
    holder: "PERSONAL",
    ...patch,
  });
  it("맞는 값은 틀린 칸이 없고 본문은 숫자만 나눠 싣는다", () => {
    expect(cardErrors(form(), now)).toEqual({});
    expect(cardRequestOf(form())).toEqual({
      cardNumber: "4111111111111111",
      expiryMonth: "11",
      expiryYear: "26",
      identity: "900101",
      passwordPrefix: "12",
    });
  });
  it("Luhn·자리 수·지난 달·월 범위·생년월일·사업자번호를 가른다", () => {
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(cardErrors(form({ number: "4111111111111112" }), now).number).toBe(
      "number"
    );
    expect(cardErrors(form({ number: "4111111" }), now).number).toBe("number");
    expect(cardErrors(form({ expiry: "1026" }), now).expiry).toBe("expired");
    expect(cardErrors(form({ expiry: "1326" }), now).expiry).toBe(
      "expiryFormat"
    );
    expect(cardErrors(form({ password: "1" }), now).password).toBe("password");
    expect(cardErrors(form({ identity: "901301" }), now).identity).toBe(
      "birth"
    );
    expect(
      cardErrors(form({ holder: "CORPORATE", identity: "900101" }), now)
        .identity
    ).toBe("business");
    expect(
      cardErrors(form({ holder: "CORPORATE", identity: "1234567890" }), now)
    ).toEqual({});
  });
  it("보이는 모양은 4자리 띄어쓰기와 셋째 자리부터의 MM/YY 다", () => {
    expect(formatCardNumber("411111111111")).toBe("4111 1111 1111");
    expect(formatExpiry("12")).toBe("12");
    expect(formatExpiry("123")).toBe("12/3");
  });
});
