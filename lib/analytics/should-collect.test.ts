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
    process.env.VERCEL_ENV = "preview";

    expect(shouldCollectAnalytics()).toBe(false);
  });

  it("Vercel 밖(로컬·e2e)에서는 집계하지 않는다", () => {
    delete process.env.VERCEL_ENV;

    expect(shouldCollectAnalytics()).toBe(false);
  });
});
