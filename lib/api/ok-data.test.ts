import { describe, expect, it } from "vitest";

import { okData } from "@/lib/api/ok-data";

describe("okData", () => {
  it("200 이면서 봉투가 성공일 때만 본문을 준다", () => {
    expect(okData({ status: 200, data: { success: true, data: { tasks: [] } } })).toEqual({ tasks: [] });
    expect(okData({ status: 200, data: { success: false, data: null } })).toBeNull();
    expect(okData({ status: 404, data: { success: false, error: { code: "NOT_FOUND" } } })).toBeNull();
    expect(okData(undefined)).toBeNull();
  });
});
