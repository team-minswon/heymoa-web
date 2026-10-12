import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { track } from "@/lib/analytics/track";
import {
  parseChecklist,
  readChecklistRaw,
  writeChecklist,
} from "@/lib/onboarding/checklist";
import { useOnboardingProgress } from "@/lib/onboarding/use-onboarding-progress";

afterEach(() => localStorage.clear());

describe("useOnboardingProgress", () => {
  // 체크리스트가 화면에 없어도(모바일 시트가 닫힘) 셸이 듣고 있으면 적힌다
  it("검토 완료·초대 이벤트를 단계 완료로 적는다", () => {
    writeChecklist("u1", { status: "open", done: [] });
    const { unmount } = renderHook(() => useOnboardingProgress("u1"));

    track("summary_confirmed");
    track("invite_sent");
    track("chat_message_sent");
    unmount();

    expect(parseChecklist(readChecklistRaw("u1"))?.done).toEqual([
      "confirm",
      "invite",
    ]);
  });
});
