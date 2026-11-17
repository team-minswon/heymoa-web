import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  pickWorkspaceId,
  readLastWorkspaceId,
  rememberWorkspaceId,
  sortByLastVisited,
} from "@/lib/workspaces/last-workspace";

const A = { workspaceId: "01AAAAAAAAAAA" };
const B = { workspaceId: "01BBBBBBBBBBB" };
const C = { workspaceId: "01CCCCCCCCCCC" };

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

  describe("sortByLastVisited", () => {
    const ids = (items: readonly { workspaceId: string }[]) =>
      items.map((item) => item.workspaceId);

    it("기억한 워크스페이스를 맨 위로 올린다", () => {
      rememberWorkspaceId(C.workspaceId);

      expect(ids(sortByLastVisited([A, B, C]))).toEqual([
        C.workspaceId,
        A.workspaceId,
        B.workspaceId,
      ]);
    });

    it("나머지의 상대 순서는 서버 순서를 지킨다", () => {
      rememberWorkspaceId(B.workspaceId);

      expect(ids(sortByLastVisited([A, B, C]))).toEqual([
        B.workspaceId,
        A.workspaceId,
        C.workspaceId,
      ]);
    });

    it("기억이 없거나 목록에 없으면 순서를 그대로 둔다", () => {
      expect(ids(sortByLastVisited([A, B, C]))).toEqual(ids([A, B, C]));

      rememberWorkspaceId("01ZZZZZZZZZZZ");
      expect(ids(sortByLastVisited([A, B, C]))).toEqual(ids([A, B, C]));
    });

    it("인자를 건드리지 않고 새 배열을 돌려준다", () => {
      rememberWorkspaceId(C.workspaceId);
      const original = [A, B, C];

      const sorted = sortByLastVisited(original);

      expect(sorted).not.toBe(original);
      expect(ids(original)).toEqual([A.workspaceId, B.workspaceId, C.workspaceId]);
    });

    it("첫 줄은 pickWorkspaceId가 여는 곳과 같다", () => {
      rememberWorkspaceId(B.workspaceId);

      expect(sortByLastVisited([A, B, C])[0].workspaceId).toBe(
        pickWorkspaceId([A, B, C])
      );
    });
  });
});
