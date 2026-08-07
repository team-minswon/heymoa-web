import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  pickWorkspaceId,
  readLastWorkspaceId,
  rememberWorkspaceId,
} from "@/lib/workspaces/last-workspace";

const A = { workspaceId: "01AAAAAAAAAAA" };
const B = { workspaceId: "01BBBBBBBBBBB" };

describe("last-workspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("기억이 없으면 목록의 첫 항목을 고른다", () => {
    expect(pickWorkspaceId([A, B])).toBe(A.workspaceId);
  });

  it("기억한 워크스페이스가 목록에 있으면 그것을 고른다", () => {
    rememberWorkspaceId(B.workspaceId);

    expect(pickWorkspaceId([A, B])).toBe(B.workspaceId);
  });

  /**
   * **이 폴백이 이 모듈의 존재 이유다.** 계정을 바꾸거나 그 워크스페이스에서 추방당하면 기억은
   * 남아 있지만 내 것이 아니다. 검증 없이 넘기면 접근 못 하는 `/w/{id}`로 보내게 된다.
   */
  it("기억한 워크스페이스가 목록에 없으면 첫 항목으로 떨어진다", () => {
    rememberWorkspaceId("01ZZZZZZZZZZZ");

    expect(pickWorkspaceId([A, B])).toBe(A.workspaceId);
  });

  it("목록이 비면 undefined다 — 부르는 쪽이 그 상태를 그린다", () => {
    rememberWorkspaceId(A.workspaceId);

    expect(pickWorkspaceId([])).toBeUndefined();
  });

  it("localStorage가 던져도 앱을 무너뜨리지 않는다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => rememberWorkspaceId(B.workspaceId)).not.toThrow();
    expect(readLastWorkspaceId()).toBeNull();
    expect(pickWorkspaceId([A, B])).toBe(A.workspaceId);
  });
});
