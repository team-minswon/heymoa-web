import { describe, expect, it } from "vitest";

import {
  endStream,
  initialStreamState,
  reduceStreamEvent,
  type ChatStreamState,
} from "@/lib/chat/stream-protocol";

function frame(event: string, payload: unknown) {
  return { event, data: JSON.stringify(payload) };
}

function reduceAll(
  events: { event: string; data: string }[],
  from: ChatStreamState = initialStreamState
) {
  return events.reduce(reduceStreamEvent, from);
}

const START = frame("message_start", {
  chatId: "01K0000000001",
  messageId: "01K0000000009",
});

describe("reduceStreamEvent", () => {
  it("message_start가 스트리밍을 열고 messageId를 잡는다", () => {
    const state = reduceStreamEvent(initialStreamState, START);
    expect(state.phase).toBe("streaming");
    expect(state.messageId).toBe("01K0000000009");
  });

  it("token이 이어붙는다", () => {
    const state = reduceAll([
      START,
      frame("token", { delta: "안녕" }),
      frame("token", { delta: "하세요" }),
    ]);
    expect(state.text).toBe("안녕하세요");
    expect(state.content).toBeNull();
  });

  it("message_end의 content가 토큰 합을 이긴다", () => {
    // 계약은 둘이 같다고 하지만 같다고 믿고 토큰 합을 남기면 새로고침 후 글이 바뀐다.
    const state = reduceAll([
      START,
      frame("token", { delta: "부분만 " }),
      frame("message_end", {
        messageId: "01K0000000009",
        content: "확정된 전체 답변입니다.",
      }),
    ]);
    expect(state.phase).toBe("idle");
    expect(state.content).toBe("확정된 전체 답변입니다.");
    expect(state.text).toBe("확정된 전체 답변입니다.");
  });

  it("error는 부분 응답을 버린다", () => {
    const state = reduceAll([
      START,
      frame("token", { delta: "응답을 만들던 중" }),
      frame("error", {
        code: "LLM_PROVIDER_ERROR",
        message: "응답 생성에 실패했습니다.",
      }),
    ]);
    expect(state.phase).toBe("failed");
    expect(state.text).toBe("");
    expect(state.error).toEqual({
      code: "LLM_PROVIDER_ERROR",
      message: "응답 생성에 실패했습니다.",
    });
  });

  it("error는 승인 대기를 함께 지운다", () => {
    // 끝난 스트림의 승인은 계약상 EXPIRED다. 남겨 두면 실패 안내 옆에 눌리는 버튼이 선다.
    const state = reduceAll([
      START,
      frame("tool_approval_request", {
        approvalId: "0K9GVJT2C4Q7F",
        toolCallId: "call_02",
        tool: "linear.create_issue",
      }),
      frame("error", { code: "LLM_PROVIDER_ERROR", message: "실패" }),
    ]);
    expect(state.phase).toBe("failed");
    expect(state.pendingApproval).toBeNull();
  });

  it("tool_call_start가 진행 중 실행 기록을 만든다", () => {
    const state = reduceAll([
      START,
      frame("tool_call_start", {
        toolCallId: "call_01",
        tool: "linear.search_issues",
        summary: "Linear 이슈 검색 중",
      }),
    ]);
    expect(state.records).toEqual([
      {
        kind: "call",
        toolCallId: "call_01",
        tool: "linear.search_issues",
        summary: "Linear 이슈 검색 중",
        status: null,
        url: null,
      },
    ]);
  });

  it("tool_call_result의 status=error는 스트림을 끝내지 않는다", () => {
    const state = reduceAll([
      START,
      frame("tool_call_start", { toolCallId: "call_01", tool: "linear.create_issue" }),
      frame("tool_call_result", {
        toolCallId: "call_01",
        status: "error",
        summary: "이슈 생성 실패",
      }),
    ]);
    expect(state.phase).toBe("streaming");
    expect(state.records).toHaveLength(1);
    expect(state.records[0]).toMatchObject({ kind: "call", status: "error" });
  });

  it("도구 실패 뒤에도 토큰이 계속 붙는다", () => {
    const state = reduceAll([
      START,
      frame("tool_call_result", { toolCallId: "call_01", status: "error", tool: "x" }),
      frame("token", { delta: "대신 이렇게 " }),
      frame("token", { delta: "정리했습니다." }),
    ]);
    expect(state.phase).toBe("streaming");
    expect(state.text).toBe("대신 이렇게 정리했습니다.");
  });

  it("tool_approval_request가 승인 대기로 멈춘다", () => {
    const state = reduceAll([
      START,
      frame("tool_approval_request", {
        approvalId: "0K9GVJT2C4Q7F",
        toolCallId: "call_02",
        tool: "linear.create_issue",
        summary: "Linear 이슈 생성",
      }),
    ]);
    expect(state.phase).toBe("awaiting_approval");
    expect(state.pendingApproval).toEqual({
      approvalId: "0K9GVJT2C4Q7F",
      tool: "linear.create_issue",
      summary: "Linear 이슈 생성",
    });
    expect(state.records[0]).toMatchObject({ kind: "approval", decision: null });
  });

  it("승인을 거친 도구의 실행 기록이 승인 요청의 도구 이름을 이어 쓴다", () => {
    // 승인 흐름은 tool_call_start 없이 곧장 결과가 오고, 결과에는 `tool`이 없다.
    const state = reduceAll([
      START,
      frame("tool_approval_request", {
        approvalId: "0K9GVJT2C4Q7F",
        toolCallId: "call_02",
        tool: "linear.create_issue",
      }),
      frame("tool_approval_resolved", {
        approvalId: "0K9GVJT2C4Q7F",
        decision: "APPROVED",
      }),
      frame("tool_call_result", {
        toolCallId: "call_02",
        status: "success",
        summary: "APP-12 생성됨",
        url: "https://linear.app/heymoa/issue/APP-12",
      }),
    ]);
    expect(state.records[1]).toMatchObject({
      kind: "call",
      tool: "linear.create_issue",
      status: "success",
    });
  });

  it("tool_approval_resolved가 대기를 풀고 결정을 기록한다", () => {
    const state = reduceAll([
      START,
      frame("tool_approval_request", {
        approvalId: "0K9GVJT2C4Q7F",
        toolCallId: "call_02",
        tool: "linear.create_issue",
      }),
      frame("tool_approval_resolved", {
        approvalId: "0K9GVJT2C4Q7F",
        decision: "REJECTED",
      }),
    ]);
    expect(state.phase).toBe("streaming");
    expect(state.pendingApproval).toBeNull();
    expect(state.records[0]).toMatchObject({
      kind: "approval",
      decision: "REJECTED",
    });
  });

  it("모르는 이벤트는 상태를 바꾸지 않는다", () => {
    const before = reduceStreamEvent(initialStreamState, START);
    expect(reduceStreamEvent(before, frame("heartbeat", {}))).toEqual(before);
  });

  it("깨진 JSON은 던지지 않고 무시한다", () => {
    const before = reduceStreamEvent(initialStreamState, START);
    expect(
      reduceStreamEvent(before, { event: "token", data: "{not json" })
    ).toEqual(before);
  });
});

describe("endStream", () => {
  it("종료 이벤트 없이 닫히면 정지 상태이고 부분 토큰은 남는다", () => {
    const streaming = reduceAll([START, frame("token", { delta: "만들던 중" })]);
    const state = endStream(streaming, "closed");
    expect(state.phase).toBe("stalled");
    expect(state.text).toBe("만들던 중");
  });

  it("message_end를 받은 뒤 닫히는 건 정상이다", () => {
    const done = reduceAll([
      START,
      frame("message_end", { messageId: "01K0000000009", content: "끝" }),
    ]);
    expect(endStream(done, "closed").phase).toBe("idle");
  });

  it("error로 끝난 스트림이 닫혀도 실패로 남는다", () => {
    const failed = reduceAll([
      START,
      frame("error", { code: "X", message: "실패" }),
    ]);
    expect(endStream(failed, "closed").phase).toBe("failed");
  });

  it("유저 중지는 부분 토큰을 남긴 채 aborted가 된다", () => {
    const streaming = reduceAll([START, frame("token", { delta: "절반" })]);
    const state = endStream(streaming, "aborted");
    expect(state.phase).toBe("aborted");
    expect(state.text).toBe("절반");
  });

  it("승인 대기 중 닫히면 정지 상태다", () => {
    const waiting = reduceAll([
      START,
      frame("tool_approval_request", {
        approvalId: "0K9GVJT2C4Q7F",
        toolCallId: "call_02",
        tool: "linear.create_issue",
      }),
    ]);
    expect(endStream(waiting, "stalled").phase).toBe("stalled");
  });
});
