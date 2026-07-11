import { describe, expect, it } from "vitest";

import { isWorkspaceRoute } from "@/lib/routes/app-route";

describe("isWorkspaceRoute", () => {
  it.each([
    "/w",
    "/w/01K0000000000",
    "/w/01K0000000000/notes/01K0000000002",
  ])("classifies %s as an app route", (pathname) => {
    expect(isWorkspaceRoute(pathname)).toBe(true);
  });

  it.each(["/", "/settings", "/privacy", "/workspace"])(
    "keeps marketing chrome for %s",
    (pathname) => {
      expect(isWorkspaceRoute(pathname)).toBe(false);
    }
  );
});
