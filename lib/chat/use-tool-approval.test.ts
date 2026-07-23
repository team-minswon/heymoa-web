import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatStreamPhase } from "@/lib/chat/stream-protocol";
import { useToolApproval } from "@/lib/chat/use-tool-approval";

const mutateMock = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/generated/agent-chat/agent-chat", () => ({
  useResolveToolApproval: () => ({ mutate: mutateMock, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

const CHAT_ID = "01K0000000003";
const pending = (approvalId: string) => ({
  approvalId,
  tool: "linear.create_issue",
  summary: "Linear 이슈 생성",
});

function failWith(error: unknown) {
  mutateMock.mockImplementation((_vars, options) => options?.onError?.(error));
}

function render(pendingArg: ReturnType<typeof pending> | null, phase: ChatStreamPhase) {
  return renderHook(
    ({ p, ph }: { p: ReturnType<typeof pending> | null; ph: ChatStreamPhase }) =>
      useToolApproval({ chatId: CHAT_ID, pending: p, streamPhase: ph }),
    { initialProps: { p: pendingArg, ph: phase } }
  );
}

describe("useToolApproval", () => {
  beforeEach(() => {
    mutateMock.mockReset().mockImplementation(() => {});
    toastError.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it("pending이 있으면 open 카드", () => {
    const { result } = render(pending("a1"), "awaiting_approval");
    expect(result.current.card).toMatchObject({
      tool: "linear.create_issue",
      state: { kind: "open" },
    });
  });

  it("approve하면 submitted로 가고 낙관적으로 뒤집지 않는다", () => {
    const { result } = render(pending("a1"), "awaiting_approval");
    act(() => result.current.approve("APPROVED"));
    expect(mutateMock).toHaveBeenCalledWith(
      { chatId: CHAT_ID, approvalId: "a1", data: { decision: "APPROVED" } },
      expect.anything()
    );
    expect(result.current.card?.state).toEqual({ kind: "submitted" });
  });

  it("종료 오류(404 만료)는 카드를 무효화한다", () => {
    failWith({ success: false, data: null, error: { code: "APPROVAL_NOT_FOUND", message: "만료되었습니다." } });
    const { result } = render(pending("a1"), "awaiting_approval");
    act(() => result.current.approve("APPROVED"));
    expect(result.current.card?.state).toMatchObject({ kind: "invalidated" });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("409 회의 종료도 무효화하고 사유가 다르다", () => {
    failWith({ success: false, data: null, error: { code: "MEETING_NOT_ACTIVE", message: "회의가 종료되었습니다." } });
    const { result } = render(pending("a1"), "awaiting_approval");
    act(() => result.current.approve("APPROVED"));
    const state = result.current.card?.state as { kind: string; reason: string };
    expect(state.reason).toContain("회의가 종료");
  });

  it("재시도 가능한 오류는 카드를 다시 열고 토스트한다", () => {
    failWith({
      success: false,
      data: null,
      error: { code: "INTERNAL_SERVER_ERROR", message: "일시 오류" },
    });
    const { result } = render(pending("a1"), "awaiting_approval");
    act(() => result.current.approve("APPROVED"));
    expect(result.current.card?.state).toEqual({ kind: "open" });
    expect(toastError).toHaveBeenCalled();
  });

  it("승인을 기다리다 스트림이 비정상 종료하면 만료 무효화 카드를 남긴다", () => {
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    expect(result.current.card?.state).toEqual({ kind: "open" });

    // 리듀서가 무종료로 pending을 지우고 phase가 stalled로 간다.
    rerender({ p: null, ph: "stalled" });
    expect(result.current.card?.state).toMatchObject({ kind: "invalidated" });
    const state = result.current.card?.state as { reason: string };
    expect(state.reason).toContain("만료");
  });

  it("새 턴이 시작되면(streaming) 지난 무효화 카드를 접는다", () => {
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    rerender({ p: null, ph: "stalled" });
    expect(result.current.card?.state).toMatchObject({ kind: "invalidated" });

    rerender({ p: null, ph: "streaming" });
    expect(result.current.card).toBeNull();
  });

  it("다음 턴의 새 승인(다른 id)은 이전 무효화에 걸리지 않는다", () => {
    failWith({ success: false, data: null, error: { code: "APPROVAL_NOT_FOUND", message: "만료되었습니다." } });
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    act(() => result.current.approve("APPROVED"));
    expect(result.current.card?.state).toMatchObject({ kind: "invalidated" });

    rerender({ p: pending("a2"), ph: "awaiting_approval" });
    expect(result.current.card?.state).toEqual({ kind: "open" });
  });

  it("스트림이 먼저 확정한 뒤 늦게 온 종료 오류는 죽은 카드를 되살리지 않는다", () => {
    // 만료가 스트림에서 REJECTED로 확정돼 pending이 지워진 뒤, 늦게 온 404가 도착하는 경합.
    let onError: ((e: unknown) => void) | undefined;
    mutateMock.mockImplementation((_vars, options) => {
      onError = options?.onError;
    });
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    act(() => result.current.approve("APPROVED"));

    // 스트림이 확정하고 정상 종료 → pending 소실.
    rerender({ p: null, ph: "idle" });
    expect(result.current.card).toBeNull();

    // 늦은 404 도착 — 이미 지나간 승인이라 무시한다.
    act(() =>
      onError?.({
        success: false,
        data: null,
        error: { code: "APPROVAL_NOT_FOUND", message: "만료" },
      })
    );
    expect(result.current.card).toBeNull();
  });

  it("pending도 무효화도 없으면 카드가 없다", () => {
    const { result } = render(null, "idle");
    expect(result.current.card).toBeNull();
  });
});
