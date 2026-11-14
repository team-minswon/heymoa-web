import { describe, expect, it } from "vitest";

import {
  parseSettingsSection,
  SETTINGS_SECTIONS,
} from "@/lib/workspace/settings-url";

describe("settings-url", () => {
  it("결제 탭을 알고, 모르는 값은 null 이다", () => {
    expect(SETTINGS_SECTIONS).toContain("billing");
    expect(parseSettingsSection("billing")).toBe("billing");
    expect(parseSettingsSection("nope")).toBeNull();
  });
});
