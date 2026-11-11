const NAMES: Record<string, string> = { FREE: "Free", PRO: "Pro" };

/** 유료 상품의 표시 이름. 서버 plan code 가 아직 시험 값(`TEST_MONTHLY_V1` 등)이어도 Pro 로 보인다 — 유료 여부는 코드 문자열이 아니라 구독 상태·entitlement kind 가 정한다. */
export const paidPlanName = (planCode: string | null | undefined) =>
  (planCode && NAMES[planCode]) || "Pro";

/** 무료 플랜 이름. 모르는 코드는 코드 그대로다. */
export const planName = (planCode: string) => NAMES[planCode] ?? planCode;
