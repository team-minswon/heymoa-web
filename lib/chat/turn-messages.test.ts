import { describe, expect, it } from "vitest";

import type { AgentChatMessagesResponseDataMessagesItem } from "@/lib/api/generated/models";
import {
  echoesSent,
  freezeTurnTime,
  isTurnReconciled,
  visibleTurnMessages,
} from "@/lib/chat/turn-messages";

type Message = AgentChatMessagesResponseDataMessagesItem;

const message = (
  role: Message["role"],
  content: string,
  turnId: string | null,
  createdAt = "2026-09-28T14:59:00.000Z"
): Message => ({
  role,
  content,
  turnId,
  createdAt,
  toolEvent: null,
  scope: [],
});

const earlier = [
  message("USER", "정리해줘", "t0"),
  message("ASSISTANT", "정리했습니다", "t0"),
];

describe("echoesSent", () => {
  it("기준선 자리의 USER 만 본다 — 같은 질문을 되풀이한 예전 턴에 걸리지 않는다", () => {
    const history = {
      cursor: null,
      activeTurn: null,
      lastTurn: null,
      messages: earlier,
    };

    expect(echoesSent(history, 2, "정리해줘")).toBe(false);
    expect(
      echoesSent(
        {
          ...history,
          messages: [...earlier, message("USER", "정리해줘", "t1")],
        },
        2,
        "정리해줘"
      )
    ).toBe(true);
  });
});

describe("isTurnReconciled", () => {
  it("정상 종료는 기준선 뒤에 같은 답이 붙었을 때만 접는다", () => {
    const stream = {
      phase: "done",
      turnId: "t1",
      content: "정리했습니다",
    } as const;

    expect(
      isTurnReconciled({
        messages: earlier,
        stream,
        baseline: 2,
        showingLocalTurn: false,
      })
    ).toBe(false);
    expect(
      isTurnReconciled({
        messages: [...earlier, message("ASSISTANT", "정리했습니다", "t1")],
        stream,
        baseline: 2,
        showingLocalTurn: false,
      })
    ).toBe(true);
  });

  it("중지된 턴은 그 턴의 ASSISTANT 행이 오면 접는다", () => {
    expect(
      isTurnReconciled({
        messages: [...earlier, message("ASSISTANT", "정리하", "t1")],
        stream: { phase: "cancelled", turnId: "t1", content: null },
        baseline: 2,
        showingLocalTurn: false,
      })
    ).toBe(true);
  });
});

describe("visibleTurnMessages", () => {
  const turn = [
    ...earlier,
    message("USER", "이어서", "t1"),
    message("THINKING", "생각", "t1"),
    message("ASSISTANT", "조각", "t1"),
  ];

  it("커서 없이 처음부터 재생하는 동안은 USER 만 남긴다", () => {
    expect(
      visibleTurnMessages(turn, {
        stream: { phase: "streaming", turnId: "t1" },
        cursor: null,
        showingLocalTurn: false,
      }).map((row) => row.content)
    ).toEqual(["정리해줘", "정리했습니다", "이어서"]);
  });

  it("커서가 있으면 생각·도구는 히스토리가 그리고 답만 접는다", () => {
    expect(
      visibleTurnMessages(turn, {
        stream: { phase: "streaming", turnId: "t1" },
        cursor: "c1",
        showingLocalTurn: false,
      }).map((row) => row.content)
    ).toEqual(["정리해줘", "정리했습니다", "이어서", "생각"]);
  });

  it("승인 대기는 열린 스트림이 없어 접지 않는다", () => {
    expect(
      visibleTurnMessages(turn, {
        stream: { phase: "awaiting_approval", turnId: "t1" },
        cursor: null,
        showingLocalTurn: false,
      })
    ).toBe(turn);
  });
});

describe("freezeTurnTime", () => {
  it("기준선부터 턴 전체를 보낸 시각만큼 옮기고 앞은 그대로 둔다", () => {
    const messages = [
      ...earlier,
      message("USER", "이어서", "t1", "2026-09-28T15:00:02.000Z"),
      message("ASSISTANT", "답", "t1", "2026-09-28T15:00:05.000Z"),
    ];

    const frozen = freezeTurnTime(messages, 2, "2026-09-28T14:59:59.000Z");

    expect(frozen.map((row) => row.createdAt)).toEqual([
      "2026-09-28T14:59:00.000Z",
      "2026-09-28T14:59:00.000Z",
      "2026-09-28T14:59:59.000Z",
      "2026-09-28T15:00:02.000Z",
    ]);
  });
});
