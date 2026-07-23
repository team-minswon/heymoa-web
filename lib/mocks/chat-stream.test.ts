import { describe, expect, it } from "vitest";

import { buildApprovalPlan, buildChatEvents } from "@/lib/mocks/chat-stream";

const names = (events: { event: string }[]) => events.map((event) => event.event);

function payloadOf(events: { event: string; data: string }[], name: string) {
  return JSON.parse(events.find((event) => event.event === name)!.data);
}

describe("buildChatEvents", () => {
  it("streams a plain answer from start to end", () => {
    const events = buildChatEvents({ chatId: "chat-1", message: "요약해줘" });

    expect(names(events)[0]).toBe("message_start");
    expect(names(events).at(-1)).toBe("message_end");
    expect(names(events).filter((name) => name === "token").length).toBeGreaterThan(
      0
    );
  });

  it("carries the same messageId from start to end", () => {
    const events = buildChatEvents({ chatId: "chat-1", message: "요약해줘" });

    expect(payloadOf(events, "message_end").messageId).toBe(
      payloadOf(events, "message_start").messageId
    );
  });

  it("asks for approval before a write tool and resolves after it", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "Linear 이슈 만들어줘",
    });

    // 토큰 개수는 문장 길이에 딸린 값이라 세지 않는다 — 이벤트의 순서가 계약이다.
    expect(names(events).filter((name) => name !== "token")).toEqual([
      "message_start",
      "tool_approval_request",
      "tool_approval_resolved",
      "tool_call_result",
      "message_end",
    ]);
    expect(names(events).indexOf("tool_approval_request")).toBeGreaterThan(
      names(events).indexOf("token")
    );

    const request = payloadOf(events, "tool_approval_request");
    // 13자 TSID가 아니면 server가 승인 row 등록을 건너뛰어 승인 API가 404가 된다 (계약).
    expect(request.approvalId).toMatch(/^[0-9A-HJKMNP-TV-Z]{13}$/);
    expect(payloadOf(events, "tool_approval_resolved").approvalId).toBe(
      request.approvalId
    );
  });

  it("pairs tool_call_result with the id that opened the call", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "Linear 이슈 만들어줘",
    });

    expect(payloadOf(events, "tool_call_result").toolCallId).toBe(
      payloadOf(events, "tool_approval_request").toolCallId
    );
  });

  it("ends with an error event and no message_end when the provider fails", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "장애를 재현해줘",
    });

    expect(names(events).at(-1)).toBe("error");
    expect(names(events)).not.toContain("message_end");
  });

  // 계약이 말하는 "스트림이 끝나는 세 번째 경로" — 종료 이벤트 없이 연결만 끊긴다.
  // web이 이걸 처리하지 않으면 영원히 로딩이다.
  it("drops the stream without a terminal event when asked", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "연결을 끊어줘",
    });

    expect(names(events)).not.toContain("message_end");
    expect(names(events)).not.toContain("error");
    expect(events.length).toBeGreaterThan(0);
  });

  it("is deterministic so tests and the demo do not drift", () => {
    const first = buildChatEvents({ chatId: "chat-1", message: "이슈 만들어줘" });
    const second = buildChatEvents({ chatId: "chat-1", message: "이슈 만들어줘" });

    expect(first).toEqual(second);
  });
});

describe("streamed tokens match the persisted content", () => {
  function joined(events: { event: string; data: string }[]) {
    return events
      .filter((event) => event.event === "token")
      .map((event) => JSON.parse(event.data).delta)
      .join("");
  }

  // 계약: 토큰을 이어붙인 결과 = message_end.content. 다르면 스트리밍 중 보이던 글이
  // 새로고침 후 다른 글로 바뀐다.
  it.each([
    ["요약해줘"],
    ["Linear 이슈 만들어줘"],
  ])("holds for %s", (message) => {
    const events = buildChatEvents({ chatId: "chat-1", message });
    const end = events.find((event) => event.event === "message_end");

    expect(joined(events).trim()).toBe(JSON.parse(end!.data).content);
  });

  it("holds on the rejected path too", () => {
    const plan = buildApprovalPlan({
      chatId: "chat-1",
      message: "Linear 이슈 만들어줘",
    })!;
    const events = [...plan.before, ...plan.after("REJECTED")];
    const end = events.find((event) => event.event === "message_end");

    expect(joined(events).trim()).toBe(JSON.parse(end!.data).content);
  });
});
