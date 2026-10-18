import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearUserFlags,
  readUserFlag,
  writeUserFlag,
} from "@/lib/storage/user-flags";

describe("user flags", () => {
  beforeEach(() => window.localStorage.clear());

  it("사용자마다 따로 적는다", () => {
    writeUserFlag("A", "endNudgeOff", "1");
    expect(readUserFlag("A", "endNudgeOff")).toBe("1");
    expect(readUserFlag("B", "endNudgeOff")).toBeNull();
  });

  it("지우면 모든 사용자의 표시만 사라지고 기기 범위 키는 남는다", () => {
    writeUserFlag("A", "endNudgeOff", "1");
    writeUserFlag("B", "feedbackSeen", "x");
    window.localStorage.setItem("heymoa:analytics-opt-out", "1");
    clearUserFlags();
    expect(readUserFlag("A", "endNudgeOff")).toBeNull();
    expect(readUserFlag("B", "feedbackSeen")).toBeNull();
    expect(window.localStorage.getItem("heymoa:analytics-opt-out")).toBe("1");
  });

  it("처음 읽을 때 옛 전역 키와 죽은 키를 한 번 지운다", async () => {
    window.localStorage.setItem("heymoa:agent-intro-dismissed", "1");
    window.localStorage.setItem("heymoa:desktop-promo-dismissed", "1");
    window.localStorage.setItem("heymoa:analytics-opt-out", "1");
    vi.resetModules();
    const fresh = await import("@/lib/storage/user-flags");
    fresh.readUserFlag("A", "agentIntroDismissed");
    expect(
      window.localStorage.getItem("heymoa:agent-intro-dismissed")
    ).toBeNull();
    expect(
      window.localStorage.getItem("heymoa:desktop-promo-dismissed")
    ).toBeNull();
    // 기기 범위인 분석 거부는 건드리지 않는다.
    expect(window.localStorage.getItem("heymoa:analytics-opt-out")).toBe("1");
  });
});
