const NAMES: Record<string, string> = { FREE: "Free", PRO: "Pro" };

/** 플랜 표시 이름. 서버 plan code 는 `FREE`·`PRO` 로 확정이다 — 모르는 코드는 코드 그대로 보인다. */
export const planName = (planCode: string) => NAMES[planCode] ?? planCode;
