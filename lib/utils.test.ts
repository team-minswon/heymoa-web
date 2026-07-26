import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  // 커스텀 radius를 tailwind-merge에 등록하지 않으면 둘 다 살아남고 CSS 선언 순서가
  // 이긴다. 실제로 모바일 설정 다이얼로그가 `rounded-none`인데 16px로 그려졌다(APP-210).
  describe("v5 형태 스케일", () => {
    it("호출부가 프리미티브 기본 radius를 이긴다", () => {
      expect(cn("rounded-panel", "rounded-none")).toBe("rounded-none");
      expect(cn("rounded-chip", "rounded-block")).toBe("rounded-block");
      expect(cn("rounded-lg", "rounded-control")).toBe("rounded-control");
    });

    it("반응형 변형은 기본값과 따로 산다", () => {
      // 모바일 각짐 + sm 이상 패널 — 둘 다 남아야 한다.
      expect(cn("rounded-panel", "rounded-none sm:rounded-panel")).toBe(
        "rounded-none sm:rounded-panel"
      );
    });
  });
});
