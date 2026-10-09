import { describe, expect, it } from "vitest";

import { isFocusChromeRoute, isWorkspaceRoute } from "@/lib/routes/app-route";

describe("isWorkspaceRoute", () => {
  it.each(["/w", "/w/01K0000000000", "/w/01K0000000000/notes/01K0000000002"])(
    "classifies %s as an app route",
    (pathname) => {
      expect(isWorkspaceRoute(pathname)).toBe(true);
    }
  );

  it.each(["/", "/settings", "/privacy", "/workspace"])(
    "keeps marketing chrome for %s",
    (pathname) => {
      expect(isWorkspaceRoute(pathname)).toBe(false);
    }
  );
});

// 동의 · 초대는 카드 하나만 세운다 — 마케팅 메뉴 없이 로고 · 로그아웃만(`focus-chrome.tsx`)
describe("isFocusChromeRoute", () => {
  it.each(["/invite", "/oauth/consent", "/oauth/authorize"])(
    "gives %s the focus chrome",
    (pathname) => {
      expect(isFocusChromeRoute(pathname)).toBe(true);
    }
  );

  it.each(["/", "/terms", "/oauth", "/invitations", "/w/01K0000000000"])(
    "leaves %s alone",
    (pathname) => {
      expect(isFocusChromeRoute(pathname)).toBe(false);
    }
  );
});
