import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  describe("v5 형태 스케일", () => {
    it("호출부가 프리미티브 기본 radius를 이긴다", () => {
      expect(cn("rounded-panel", "rounded-none")).toBe("rounded-none");
      expect(cn("rounded-chip", "rounded-block")).toBe("rounded-block");
      expect(cn("rounded-lg", "rounded-control")).toBe("rounded-control");
    });

    it("반응형 변형은 기본값과 따로 산다", () => {
      expect(cn("rounded-panel", "rounded-none sm:rounded-panel")).toBe(
        "rounded-none sm:rounded-panel"
      );
    });
  });
});
