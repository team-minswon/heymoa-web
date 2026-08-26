import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatStreamPhase, ToolArgs } from "@/lib/chat/stream-protocol";
import { useToolApproval } from "@/lib/chat/use-tool-approval";

/** 주입된 승인 호출. 열렸으면 null, 실패면 사유를 돌려준다. */
const resolveMock = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({ toast: { error: toastError } }));

const pending = (approvalId: string) => ({
  approvalId,
  tool: "linear.create_issue",
  summary: "Linear 이슈 생성",
  args: null as ToolArgs,
});

function failWith(code: string, message: string) {
  resolveMock.mockResolvedValue({ code, message });
}

function render(
  pendingArg: ReturnType<typeof pending> | null,
  phase: ChatStreamPhase
) {
  return renderHook(
    ({
      p,
      ph,
    }: {
      p: ReturnType<typeof pending> | null;
      ph: ChatStreamPhase;
    }) =>
      useToolApproval({ pending: p, streamPhase: ph, resolve: resolveMock }),
    { initialProps: { p: pendingArg, ph: phase } }
  );
}

describe("useToolApproval", () => {
  beforeEach(() => {
    resolveMock.mockReset().mockResolvedValue(null);
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

  it("approve하면 submitted로 가고 낙관적으로 뒤집지 않는다", async () => {
    const { result } = render(pending("a1"), "awaiting_approval");
    await act(async () => result.current.approve("APPROVED"));
    expect(resolveMock).toHaveBeenCalledWith("a1", "APPROVED");
    expect(result.current.card?.state).toEqual({ kind: "submitted" });
  });

  it("종료 오류(404)는 카드를 무효화한다", async () => {
    failWith("APPROVAL_NOT_FOUND", "이미 처리됐습니다.");
    const { result } = render(pending("a1"), "awaiting_approval");
    await act(async () => result.current.approve("APPROVED"));
    expect(result.current.card?.state).toMatchObject({ kind: "invalidated" });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("대화가 없어진 404도 무효화하고 사유가 다르다", async () => {
    failWith("AGENT_CHAT_NOT_FOUND", "대화를 찾을 수 없습니다.");
    const { result } = render(pending("a1"), "awaiting_approval");
    await act(async () => result.current.approve("APPROVED"));
    const state = result.current.card?.state as {
      kind: string;
      reason: string;
    };
    expect(state.reason).toContain("대화를 찾을 수 없어");
  });

  it("★ 자리가 없다는 503은 terminal이 아니다 — 잠금을 풀고 토스트한다", async () => {
    // 승인을 되돌린 것이라 잠시 뒤 다시 누르면 된다. 무효화하면 유일한 재시도가 막힌다.
    failWith("AGENT_CHAT_CAPACITY_EXCEEDED", "잠시 뒤 다시 시도해 주세요.");
    const { result } = render(pending("a1"), "awaiting_approval");
    await act(async () => result.current.approve("APPROVED"));
    expect(result.current.card?.state).toEqual({ kind: "open" });
    expect(toastError).toHaveBeenCalledWith("잠시 뒤 다시 시도해 주세요.");
  });

  it("재시도 가능한 오류는 카드를 다시 열고 토스트한다", async () => {
    failWith("INTERNAL_SERVER_ERROR", "일시 오류");
    const { result } = render(pending("a1"), "awaiting_approval");
    await act(async () => result.current.approve("APPROVED"));
    expect(result.current.card?.state).toEqual({ kind: "open" });
    expect(toastError).toHaveBeenCalled();
  });

  it("승인을 기다리다 스트림이 비정상 종료하면 무효화 카드를 남긴다", () => {
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    expect(result.current.card?.state).toEqual({ kind: "open" });

    // 리듀서가 무종료로 pending을 지우고 phase가 stalled로 간다.
    rerender({ p: null, ph: "failed" });
    expect(result.current.card?.state).toMatchObject({ kind: "invalidated" });
    const state = result.current.card?.state as { reason: string };
    expect(state.reason).toContain("대화가 끝났습니다");
  });

  it("새 턴이 시작되면(streaming) 지난 무효화 카드를 접는다", () => {
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    rerender({ p: null, ph: "failed" });
    expect(result.current.card?.state).toMatchObject({ kind: "invalidated" });

    rerender({ p: null, ph: "streaming" });
    expect(result.current.card).toBeNull();
  });

  it("다음 턴의 새 승인(다른 id)은 이전 무효화에 걸리지 않는다", async () => {
    failWith("APPROVAL_NOT_FOUND", "이미 처리됐습니다.");
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    await act(async () => result.current.approve("APPROVED"));
    expect(result.current.card?.state).toMatchObject({ kind: "invalidated" });

    rerender({ p: pending("a2"), ph: "awaiting_approval" });
    expect(result.current.card?.state).toEqual({ kind: "open" });
  });

  it("스트림이 먼저 확정한 뒤 늦게 온 종료 오류는 죽은 카드를 되살리지 않는다", async () => {
    // 2차가 확정해 pending이 지워진 뒤, 늦게 온 404가 도착하는 경합.
    let settle: ((e: unknown) => void) | undefined;
    resolveMock.mockImplementation(
      () => new Promise((resolve) => (settle = resolve))
    );
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    act(() => result.current.approve("APPROVED"));

    // 스트림이 확정하고 정상 종료 → pending 소실.
    rerender({ p: null, ph: "done" });
    expect(result.current.card).toBeNull();

    // 늦은 404 도착 — 이미 지나간 승인이라 무시한다.
    await act(async () =>
      settle?.({ code: "APPROVAL_NOT_FOUND", message: "이미 처리됐습니다." })
    );
    expect(result.current.card).toBeNull();
  });

  // ★ 인자를 나르는 것은 tool_call_start 하나뿐이고, 카드가 「무엇을 승인하나」를 말한다
  it("카드가 인자를 그대로 들고 있다 — 서버도 화면도 해석하지 않는다", () => {
    // **참조가 안정적이어야 한다.** 훅이 렌더 중에 직전 pending을 추적하므로
    // 인라인 객체를 넘기면 매 렌더가 새 값이라 무한 렌더가 된다.
    const withArgs = { ...pending("a1"), args: { title: "회의록", 중첩: { 값: 1 } } };
    const { result } = render(withArgs, "awaiting_approval");
    expect(result.current.card?.args).toEqual({ title: "회의록", 중첩: { 값: 1 } });
  });

  it("요청한 사람이 아니면(403) 무효화한다", async () => {
    failWith("NOT_APPROVAL_OWNER", "권한이 없습니다.");
    const { result } = render(pending("a1"), "awaiting_approval");
    await act(async () => result.current.approve("APPROVED"));
    expect(result.current.card?.state).toMatchObject({
      kind: "invalidated",
      reason: "이 승인은 요청한 사람만 처리할 수 있습니다.",
    });
  });

  // ★ 만료가 없어졌다. 만료라고 말하면 없는 시계를 있다고 하는 것이다
  it("안 누른 채 끝나면 만료가 아니라 「처리하지 못한 채 끝났다」로 말한다", () => {
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    rerender({ p: null, ph: "failed" });
    const state = result.current.card?.state;
    expect(state).toMatchObject({ kind: "invalidated" });
    expect(state && "reason" in state ? state.reason : "").toBe(
      "승인을 처리하지 못한 채 대화가 끝났습니다."
    );
  });

  it("답이 정상적으로 끝난 것은 비정상 종료가 아니다", () => {
    const { result, rerender } = render(pending("a1"), "awaiting_approval");
    rerender({ p: null, ph: "done" });
    expect(result.current.card).toBeNull();
  });

  it("pending도 무효화도 없으면 카드가 없다", () => {
    const { result } = render(null, "done");
    expect(result.current.card).toBeNull();
  });
});
