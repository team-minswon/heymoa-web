import { afterEach, describe, expect, it } from "vitest";

import { shouldCollectAnalytics } from "@/lib/analytics/should-collect";

const original = process.env.VERCEL_ENV;

afterEach(() => {
  if (original === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = original;
});

describe("shouldCollectAnalytics", () => {
  it("production에서만 집계한다", () => {
    process.env.VERCEL_ENV = "production";

    expect(shouldCollectAnalytics()).toBe(true);
  });

  it("preview 배포에서는 집계하지 않는다", () => {
    // preview도 NODE_ENV=production으로 돌아서 Vercel 패키지의 자체 판정은 통과한다.
    // 여기서 막지 않으면 브랜치를 올릴 때마다 프로덕션 지표에 섞인다.
    process.env.VERCEL_ENV = "preview";

    expect(shouldCollectAnalytics()).toBe(false);
  });

  it("Vercel 밖(로컬·e2e)에서는 집계하지 않는다", () => {
    delete process.env.VERCEL_ENV;

    expect(shouldCollectAnalytics()).toBe(false);
  });
});
