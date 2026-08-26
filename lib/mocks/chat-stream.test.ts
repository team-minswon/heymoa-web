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

    // 토큰 개수는 문장 길이에 딸린 값이라 세지 않는다 — 이벤트의 순서가 계약이다.
    expect(names(events).filter((name) => name !== "token")).toEqual([
      "message_start",
      "thinking_delta",
      "thinking_delta",
      // **인자를 나르는 프레임.** 계약(ai)은 쓰기 도구에도 이것을 먼저 낸다 —
      // 승인 카드가 「무엇을 승인하나」를 여기서 집어 간다.
      "tool_call_start",
      "tool_approval_request",
      // 여기서 1차가 끝난다. 아래는 승인 API가 여는 2차 스트림이다 —
      // **`tool_call_start`가 없다**(계약).
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

  /**
   * ★ 제일 큰 구멍이었던 자리. 파서(`stream-protocol.ts`)와 화면이 목이 한 번도 안 내던
   * 값에 매달려 있었다. **목이 낸 것을 파서에 그대로 먹여서** 계약 모양을 못박는다 —
   * 목만 통과하는 모양이면 여기서 깨진다.
   */
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
    // ★ **넓혔다는 알림이 이 목록 하나다.** 묻는 카드가 없으므로, 범위 밖 회의록이
    // 여기 안 서면 사용자는 자기가 붙인 것만 봤다고 믿는다.
    expect(state.refs.map((ref) => ref.title)).toEqual([
      "주간 배포 회의",
      "결제 개편 킥오프",
    ]);
    expect(state.phase).toBe("done");
  });

  /** `error` 없이 `turn_failed`만 오는 갈래. 안 열면 화면이 EOF까지 로딩으로 남는다. */
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
    // 다시 눌러도 되는 실패다. 문구는 web이 만든다 — server는 code만 보낸다.
    expect(state.retryable).toBe(true);
    expect(state.error?.message).toContain("처리량");
  });

  it("시나리오라고 치면 쓸 수 있는 키워드를 전부 답한다", () => {
    const events = buildChatEvents({
      chatId: "chat-1",
      message: "시나리오 알려줘",
    });
    const content = payloadOf(events, "message_end").content as string;

    // 코드를 읽어야만 알 수 있던 것을 없애는 것이 이 시나리오의 목적이다 —
    // 표에 키워드를 더하고 안내에 안 실리면 여기서 깨진다.
    for (const scenario of Object.values(CHAT_SCENARIOS)) {
      expect(content).toContain(scenario.keyword);
    }
    // 안내는 도구도 생각도 안 쓴다 — 목이 자기 사용법을 답할 뿐이다.
    expect(names(events).filter((name) => name !== "token")).toEqual([
      "message_start",
      "message_end",
    ]);
  });

  /**
   * 전송만 바꾸는 시나리오(`kind: transport`)는 **시퀀스를 안 건드린다.** 목이 여기서
   * 갈리면 「좀비 턴」·「느린 첫 프레임」이 아니라 다른 답이 흘러 버린다.
   */
  it.each([["좀비"], ["천천히"], ["버퍼를 비워줘"], ["밀리게 해줘"]])(
    "%s는 이벤트 시퀀스를 안 바꾼다",
    (keyword) => {
      // 답 길이는 메시지에서 파생한 시드에 딸린 값이라 토큰 수는 세지 않는다.
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

    // 「승인 대기 중에 버퍼를 비운다」가 실제로 보고 싶은 조합이다.
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
  /**
   * 분기는 `includes`라 키워드 하나가 다른 키워드를 품으면 **뒤 갈래가 영영 안 걸린다.**
   * 표를 늘릴 때 여기서 막는다.
   */
  it("키워드가 서로를 품지 않는다", () => {
    const keywords = Object.values(CHAT_SCENARIOS).map((each) => each.keyword);

    for (const keyword of keywords) {
      const others = keywords.filter((other) => other !== keyword);
      expect(others.some((other) => other.includes(keyword))).toBe(false);
    }
  });
});

describe("general chat answer pool (APP-156)", () => {
  it("picks a pool answer deterministically per input", () => {
    expect(answerOf("요약해줘", 0)).toBe(answerOf("요약해줘", 0));
    expect(GENERAL_CHAT_ANSWERS).toContain(answerOf("요약해줘", 0));
  });

  it("gives an answer long enough to judge density (multi-sentence)", () => {
    // 고정 한 줄로 회귀하면 밀도를 못 본다 — 후보는 모두 여러 문장이어야 한다.
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

  // 계약: 토큰을 이어붙인 결과 = message_end.content. 다르면 스트리밍 중 보이던 글이
  // 새로고침 후 다른 글로 바뀐다.
  it.each([
    ["요약해줘"],
    ["Linear 이슈 만들어줘"],
    ["범위 밖인가"],
    ["시나리오"],
  ])(
    "holds for %s",
    (message) => {
      const events = buildChatEvents({ chatId: "chat-1", message });
      const end = events.find((event) => event.event === "message_end");

      expect(joined(events).trim()).toBe(JSON.parse(end!.data).content);
    }
  );

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
    // 토큰을 이어붙인 것이 곧 본문이다 — 스트리밍 중 보이던 글과 저장된 글이 같아야 한다.
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
  /**
   * 예전에는 `tsid()`가 **무엇을 넣든 `0000000000000`** 을 돌려줬다. 형식(13자 Crockford)은
   * 계약을 지켜서 아무 검사도 안 걸렸고, 대화 하나에서 승인을 두 번 받으면 두 번째 카드가
   * 앞의 `submittedId` 와 id 가 같아 **누르기도 전에 잠긴 채로** 떴다.
   */
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
