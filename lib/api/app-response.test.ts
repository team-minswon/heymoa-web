import { describe, expect, it } from "vitest";
import { AppResponseError, unwrapAppResponse } from "@/lib/api/app-response";

describe("unwrapAppResponse", () => {
  it("returns successful data", () => {
    expect(
      unwrapAppResponse({ success: true, data: { id: "01K0000000000" } })
    ).toEqual({
      id: "01K0000000000",
    });
  });

  it("throws the application error code", () => {
    expect(() =>
      unwrapAppResponse({
        success: false,
        error: {
          code: "NOTE_NOT_FOUND",
          message: "노트를 찾을 수 없습니다.",
        },
      })
    ).toThrow(AppResponseError);
  });
});
