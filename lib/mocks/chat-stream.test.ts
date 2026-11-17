import { describe, expect, it } from "vitest";

import {
  initialStreamState,
  reduceStreamEvent,
} from "@/lib/chat/stream-protocol";
import { CHAT_SCENARIOS, leadSilenceMs } from "@/lib/mocks/chat-scenarios";
import {
  buildApprovalPlan,
  buildChatEvents,
  GENERAL_CHAT_ANSWERS,
} from "@/lib/mocks/chat-stream";

const names = (events: { event: string }[]) =>
  events.map((event) => event.event);

function payloadOf(events: { event: string; data: string }[], name: string) {
  return JSON.parse(events.find((event) => event.event === name)!.data);
}

function answerOf(message: string, turn: number) {
  const events = buildChatEvents({ chatId: "chat-1", message, turn });
  return payloadOf(events, "message_end").content as string;
}

describe("buildChatEvents", () => {
  it("streams a plain answer from start to end", () => {
    const events = buildChatEvents({ chatId: "chat-1", message: "요약해줘" });

    expect(names(events)[0]).toBe("message_start");
    expect(names(events).at(-1)).toBe("message_end");
    expect(
      names(events).filter((name) => name === "token").length
    ).toBeGreaterThan(0);
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

    expect(names(events).filter((name) => name !== "token")).toEqual([
      "message_start",
      "thinking_delta",
      "thinking_delta",
      "tool_call_start",
      "tool_approval_request",
      "tool_approval_resolved",
      "tool_call_result",
      "message_end",
    ]);
    expect(names(events).indexOf("tool_approval_request")).toBeGreaterThan(
      names(events).indexOf("token")
    );

    const request = payloadOf(events, "tool_approval_request");
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

  it("drops the stream without a terminal event when asked", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "연결을 끊어줘",
    });

    expect(names(events)).not.toContain("message_end");
    expect(names(events)).not.toContain("error");
    expect(events.length).toBeGreaterThan(0);
  });

  it("범위 밖까지 넓히면 그 회의록이 근거 줄에 선다", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "결제 개편 얘기는 범위 밖인가",
      scope: [{ kind: "note", id: "note-1", title: "주간 배포 회의" }],
    });

    expect(names(events).filter((name) => name !== "token")).toEqual([
      "message_start",
      "thinking_delta",
      "tool_call_start",
      "tool_call_result",
      "message_end",
    ]);

    const state = events.reduce(reduceStreamEvent, initialStreamState);
    expect(state.refs.map((ref) => ref.title)).toEqual([
      "주간 배포 회의",
      "결제 개편 킥오프",
    ]);
    expect(state.phase).toBe("done");
  });

  it("용량이면 error 없이 turn_failed로 끝난다", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "용량 초과를 보여줘",
      turnId: "turn-1",
    });

    expect(names(events)).not.toContain("error");
    expect(names(events)).not.toContain("message_end");
    expect(names(events).at(-1)).toBe("turn_failed");
    expect(payloadOf(events, "turn_failed")).toEqual({
      turnId: "turn-1",
      code: "CAPACITY_EXCEEDED",
      retryable: true,
    });

    const state = events.reduce(reduceStreamEvent, initialStreamState);
    expect(state.phase).toBe("failed");
    expect(state.retryable).toBe(true);
    expect(state.error).toEqual({ code: "CAPACITY_EXCEEDED", message: null });
  });

  it("시나리오라고 치면 쓸 수 있는 키워드를 전부 답한다", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "시나리오 알려줘",
    });
    const content = payloadOf(events, "message_end").content as string;

    for (const scenario of Object.values(CHAT_SCENARIOS)) {
      expect(content).toContain(scenario.keyword);
    }
    expect(names(events).filter((name) => name !== "token")).toEqual([
      "message_start",
      "message_end",
    ]);
  });

  it.each([["좀비"], ["천천히"], ["버퍼를 비워줘"], ["밀리게 해줘"]])(
    "%s는 이벤트 시퀀스를 안 바꾼다",
    (keyword) => {
      const shape = (message: string) =>
        names(buildChatEvents({ chatId: "chat-1", message })).filter(
          (name) => name !== "token"
        );

      expect(shape(`요약, ${keyword}`)).toEqual(shape("요약"));
    }
  );

  it("천천히만 첫 프레임 앞에 침묵을 넣는다", () => {
    expect(leadSilenceMs("천천히 답해줘")).toBe(3_000);
    expect(leadSilenceMs("요약해줘")).toBe(0);
  });

  it("전송 시나리오는 승인 흐름과 섞여도 승인이 살아 있다", () => {
    const plan = buildApprovalPlan({
      chatId: "chat-1",
      message: "Linear 이슈 만들어줘, 버퍼를 비워줘",
    });

    expect(plan).not.toBeNull();
  });

  it("다른 스트림 시나리오가 섞이면 승인이 자리를 내준다", () => {
    const plan = buildApprovalPlan({
      chatId: "chat-1",
      message: "이슈 얘기는 범위 밖인가",
    });

    expect(plan).toBeNull();
  });

  it("is deterministic so tests and the demo do not drift", () => {
    const first = buildChatEvents({
      chatId: "chat-1",
      message: "이슈 만들어줘",
    });
    const second = buildChatEvents({
      chatId: "chat-1",
      message: "이슈 만들어줘",
    });

    expect(first).toEqual(second);
  });
});

describe("시나리오 표", () => {
  it("키워드가 서로를 품지 않는다", () => {
    const keywords = Object.values(CHAT_SCENARIOS).map((each) => each.keyword);

    for (const keyword of keywords) {
      const others = keywords.filter((other) => other !== keyword);
      expect(others.some((other) => other.includes(keyword))).toBe(false);
    }
  });
});

describe("general chat answer pool", () => {
  it("picks a pool answer deterministically per input", () => {
    expect(answerOf("요약해줘", 0)).toBe(answerOf("요약해줘", 0));
    expect(GENERAL_CHAT_ANSWERS).toContain(answerOf("요약해줘", 0));
  });

  it("gives an answer long enough to judge density (multi-sentence)", () => {
    for (const answer of GENERAL_CHAT_ANSWERS) {
      expect(answer.length).toBeGreaterThan(60);
    }
  });

  it("varies the answer across turns instead of one fixed line", () => {
    const distinct = new Set(
      Array.from({ length: 12 }, (_, turn) => answerOf("요약해줘", turn))
    );
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe("streamed tokens match the persisted content", () => {
  function joined(events: { event: string; data: string }[]) {
    return events
      .filter((event) => event.event === "token")
      .map((event) => JSON.parse(event.data).delta)
      .join("");
  }

  it.each([
    ["요약해줘"],
    ["Linear 이슈 만들어줘"],
    ["범위 밖인가"],
    ["시나리오"],
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

describe("길게", () => {
  it("일반 답보다 훨씬 긴 답을 흘린다 — 스크롤과 「중지」를 볼 자리다", () => {
    const long = buildChatEvents({ chatId: "chat-1", message: "길게 답해줘" });
    const plain = buildChatEvents({ chatId: "chat-1", message: "요약해줘" });

    const content = payloadOf(long, "message_end").content as string;
    expect(content.length).toBeGreaterThan(
      (payloadOf(plain, "message_end").content as string).length * 3
    );
    expect(
      long
        .filter((event) => event.event === "token")
        .map((event) => JSON.parse(event.data).delta)
        .join("")
        .trimEnd()
    ).toBe(content);
  });
});

describe("★ 목의 id 가 서로 다르다", () => {
  it("승인 id 가 턴마다 달라진다", () => {
    const ids = [0, 1, 2].map(
      (turn) =>
        buildApprovalPlan({
          chatId: "chat-1",
          message: "이슈 만들어줘",
          turn,
        })!.approvalId
    );

    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{13}$/);
  });

  it("대화가 다르면 승인 id 도 다르다", () => {
    const a = buildApprovalPlan({ chatId: "chat-1", message: "이슈" })!;
    const b = buildApprovalPlan({ chatId: "chat-2", message: "이슈" })!;

    expect(a.approvalId).not.toBe(b.approvalId);
  });
});

describe("진행 문장", () => {
  it("★ 진행 문장은 thinking_delta 이고 ai 처럼 줄바꿈으로 끝난다 — 본문 token 에 안 섞인다", () => {
    const events = buildChatEvents({ chatId: "chat-1", message: "요약해줘" });
    const lines = events
      .filter((event) => event.event === "thinking_delta")
      .map((event) => JSON.parse(event.data).text as string);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.endsWith("\n"))).toBe(true);
    const answer = payloadOf(events, "message_end").content as string;
    expect(lines.some((line) => answer.includes(line.trim()))).toBe(false);
  });

  it("「옛 방식」은 진행 문장을 본문 token 으로 흘린다 — 이관 안 한 옛 대화의 모양이다", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "옛 방식으로",
    });
    expect(names(events)).not.toContain("thinking_delta");
    const answer = payloadOf(events, "message_end").content as string;
    expect(answer.split("\n\n")[0]).toMatch(/찾아볼게요\.$/);
  });
});
