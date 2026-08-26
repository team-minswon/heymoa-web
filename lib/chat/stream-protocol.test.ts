import { describe, expect, it, vi } from "vitest";

import { answerText } from "@/lib/chat/blocks";
import {
  CHAT_STREAM_PHASES,
  endStream,
  failedTurnState,
  initialStreamState,
  KNOWN_EVENTS,
  reduceStreamEvent,
  resumedState,
  toolArgs,
  type ChatStreamState,
} from "@/lib/chat/stream-protocol";

/** `data:`는 payload 그 자체다. 봉투가 없고 번호는 `id:` 줄에만 있다. */
const frame = (id: number | null, event: string, data: unknown = {}) => ({
  id: id === null ? undefined : String(id),
  event,
  data: JSON.stringify(data),
});

/** 프레임 열을 초기 상태부터 차례로 접는다. */
function fold(...events: ReturnType<typeof frame>[]): ChatStreamState {
  return events.reduce(reduceStreamEvent, initialStreamState);
}

const started = frame(1, "turn_started", { turnId: "t1", startSeq: 1 });

describe("상태는 여섯이고 늘리지 않는다", () => {
  it("목록이 spec 과 글자 그대로 같다", () => {
    expect([...CHAT_STREAM_PHASES]).toEqual([
      "idle",
      "streaming",
      "awaiting_approval",
      "done",
      "failed",
      "cancelled",
    ]);
  });
});

describe("아는 이벤트", () => {
  it("계약의 13종이 전부 있다", () => {
    expect([...KNOWN_EVENTS].sort()).toEqual(
      [
        "turn_started",
        "message_start",
        "token",
        "thinking_delta",
        "tool_call_start",
        "tool_call_result",
        "tool_approval_request",
        "tool_approval_resolved",
        "message_end",
        "error",
        "turn_failed",
        "turn_cancelled",
        "stream_resync",
      ].sort()
    );
  });

  it("모르는 이벤트로 화면이 안 죽되 조용히 삼키지도 않는다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = fold(started, frame(2, "새_이벤트", {}));
    expect(state.phase).toBe("streaming");
    expect(state.seq).toBe(2); // 번호를 먹었으면 이미 지나온 자리다
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("하트비트는 경고하지 않고 커서도 안 민다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = fold(started, { id: undefined, event: "heartbeat", data: "{}" });
    expect(state.seq).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("turn_started", () => {
  it("turnId 의 유일한 출처다 — 중지가 그 값을 기다린다", () => {
    expect(fold(started)).toMatchObject({ turnId: "t1", seq: 1 });
  });

  // 첫 토큰을 기다렸다 켜면 답 말풍선이 그때 생겨 레이아웃이 밀린다
  it("첫 토큰 전에 흐르는 중이 된다 — 말풍선이 먼저 선다", () => {
    expect(fold(started).phase).toBe("streaming");
  });
});

// ★ 규칙 7 — 이 검사가 하나 있어야 「초기화하는 게 자연스럽지 않나」로 안 되돌아간다
describe("message_start 가 상태를 리셋하지 않는다", () => {
  it("재접속 백로그의 앞 턴 message_start 가 복원한 블록을 안 지운다", () => {
    const restored = reduceStreamEvent(
      resumedState({ cursor: 10, turnId: "t0", pendingApproval: null }),
      frame(11, "token", { delta: "앞 턴의 답" })
    );
    const after = reduceStreamEvent(
      restored,
      frame(12, "message_start", { chatId: "c1", messageId: "m9" })
    );
    expect(answerText(after.blocks)).toBe("앞 턴의 답");
    expect(after.messageId).toBe("m9");
  });
});

describe("커서", () => {
  it("id: 줄만 민다 — payload 의 어떤 값도 커서가 아니다", () => {
    expect(fold(frame(1, "turn_started", { turnId: "t1", startSeq: 999 })).seq).toBe(1);
  });

  it("턴 경계의 구멍은 유실이 아니다", () => {
    const state = fold(started, frame(1001, "token", { delta: "다" }));
    expect(state.seq).toBe(1001);
    expect(answerText(state.blocks)).toBe("다");
  });

  it("커서보다 작거나 같은 번호는 통째로 버린다", () => {
    const state = fold(
      started,
      frame(10, "token", { delta: "안" }),
      frame(9, "token", { delta: "중복" }),
      frame(10, "token", { delta: "중복" })
    );
    expect(answerText(state.blocks)).toBe("안");
    expect(state.seq).toBe(10);
  });

  it("깨진 payload 여도 커서는 멈추지 않는다", () => {
    const state = reduceStreamEvent(fold(started), {
      id: "5",
      event: "token",
      data: "{깨짐",
    });
    expect(state.seq).toBe(5);
  });

  // 0 은 「처음부터 다시」가 아니라 「받을 백로그가 없다」는 뜻이다
  it("복원 커서 0 은 null 이 아니다", () => {
    expect(resumedState({ cursor: 0, turnId: "t1", pendingApproval: null }).seq).toBe(0);
  });
});

describe("본문", () => {
  it("토큰은 누적본이 아니라 델타다", () => {
    const state = fold(
      started,
      frame(2, "token", { delta: "안" }),
      frame(3, "token", { delta: "녕" })
    );
    expect(answerText(state.blocks)).toBe("안녕");
  });

  // ★ 새로고침하면 글이 달라지던 결함
  it("message_end 의 content 가 토큰 합을 이기고 done 으로 간다", () => {
    const state = fold(
      started,
      frame(2, "token", { delta: "안" }),
      frame(3, "message_end", { messageId: "m1", content: "안녕하세요", refs: [] })
    );
    expect(answerText(state.blocks)).toBe("안녕하세요");
    expect(state).toMatchObject({ phase: "done", content: "안녕하세요" });
  });

  it("refs 는 id·title 이 다 있는 것만 남긴다", () => {
    const state = fold(
      started,
      frame(2, "message_end", {
        messageId: "m1",
        content: "답",
        refs: [
          { id: "n1", title: "주간 회의" },
          { id: "n2", title: null },
          { title: "이름만" },
        ],
      })
    );
    expect(state.refs).toEqual([{ kind: "note", id: "n1", title: "주간 회의" }]);
  });
});

describe("도구", () => {
  it("인자를 나르는 것은 tool_call_start 하나뿐이다", () => {
    const state = fold(
      started,
      frame(2, "tool_call_start", {
        toolCallId: "c1",
        tool: "write",
        args: { title: "회의록" },
      })
    );
    expect(state.blocks[0]).toMatchObject({ kind: "tool", args: { title: "회의록" } });
  });

  // ★ 절대 같은 갈래에 두지 않는다
  it("도구 실패는 턴 실패가 아니다 — 토큰이 이어진다", () => {
    const state = fold(
      started,
      frame(2, "tool_call_start", { toolCallId: "c1", tool: "search" }),
      frame(3, "tool_call_result", { toolCallId: "c1", status: "error" }),
      frame(4, "token", { delta: "그래도 이어진다" })
    );
    expect(state.phase).toBe("streaming");
    expect(answerText(state.blocks)).toBe("그래도 이어진다");
  });

  it("모르는 target.kind 도 칩을 만들되 화면이 summary 로 떨어뜨릴 수 있게 둔다", () => {
    const state = fold(
      started,
      frame(2, "tool_call_start", {
        toolCallId: "c1",
        tool: "x",
        summary: "무언가 했습니다",
        target: { kind: "미래도구", id: "z" },
      })
    );
    expect(state.blocks[0]).toMatchObject({
      summary: "무언가 했습니다",
      target: { kind: "미래도구", id: "z", title: null },
    });
  });

  it("target 에 kind 가 없으면 null 로 접는다", () => {
    const state = fold(
      started,
      frame(2, "tool_call_start", { toolCallId: "c1", tool: "x", target: { id: "z" } })
    );
    expect(state.blocks[0]).toMatchObject({ target: null });
  });
});

describe("승인", () => {
  it("스트림을 닫고 승인 대기로 가며 인자를 도구 블록에서 집는다", () => {
    const state = fold(
      started,
      frame(2, "tool_call_start", {
        toolCallId: "c1",
        tool: "write",
        args: { title: "회의록" },
      }),
      frame(3, "tool_approval_request", {
        approvalId: "a1",
        toolCallId: "c1",
        tool: "write",
      })
    );
    expect(state.phase).toBe("awaiting_approval");
    expect(state.pendingApproval).toMatchObject({
      approvalId: "a1",
      args: { title: "회의록" },
    });
  });

  it("도구 블록을 못 찾아도 카드가 summary 만으로 선다", () => {
    const state = fold(
      started,
      frame(2, "tool_approval_request", {
        approvalId: "a1",
        toolCallId: "없음",
        tool: "write",
        summary: "만들까요?",
      })
    );
    expect(state.pendingApproval).toMatchObject({ summary: "만들까요?", args: null });
  });

  it("확정되면 카드가 사라지고 기록이 남는다", () => {
    const state = fold(
      started,
      frame(2, "tool_approval_request", { approvalId: "a1", toolCallId: "c1", tool: "w" }),
      frame(3, "tool_approval_resolved", { approvalId: "a1", decision: "REJECTED" })
    );
    expect(state.phase).toBe("streaming");
    expect(state.pendingApproval).toBeNull();
    expect(state.blocks.find((b) => b.kind === "approval")).toMatchObject({
      decision: "REJECTED",
    });
  });
});

// ★ 여기서 스트림을 닫으면 화면이 server 의 코드를 못 받는다
describe("ai 의 error 는 종료가 아니다", () => {
  it("phase 를 안 바꾸고 본문도 안 버린다", () => {
    const state = fold(
      started,
      frame(2, "token", { delta: "쓰던 글" }),
      frame(3, "error", { code: "X", message: "무언가 틀렸습니다" })
    );
    expect(state.phase).toBe("streaming");
    expect(answerText(state.blocks)).toBe("쓰던 글");
    expect(state.error).toEqual({ code: "X", message: "무언가 틀렸습니다" });
  });

  it("뒤따르는 turn_failed 의 코드가 이긴다", () => {
    const state = fold(
      started,
      frame(2, "error", { code: "X", message: "ai 날문구" }),
      frame(3, "turn_failed", { turnId: "t1", code: "UPSTREAM_ERROR", retryable: true })
    );
    expect(state).toMatchObject({ phase: "failed", retryable: true });
    expect(state.error?.code).toBe("UPSTREAM_ERROR");
  });
});

describe("턴 종료", () => {
  it("turn_failed 는 반쯤 쓰인 본문을 버린다 — 없는 글이 남으면 안 된다", () => {
    const state = fold(
      started,
      frame(2, "thinking_delta", { text: "음" }),
      frame(3, "token", { delta: "반쯤" }),
      frame(4, "turn_failed", { turnId: "t1", code: "TURN_TIMEOUT", retryable: true })
    );
    expect(answerText(state.blocks)).toBe("");
    // 무엇을 하다 실패했는지가 사유의 절반이라 생각은 남긴다
    expect(state.blocks.some((b) => b.kind === "thinking")).toBe(true);
  });

  it("모르는 실패 코드도 기본 문구로 접는다", () => {
    const state = fold(started, frame(2, "turn_failed", { turnId: "t1", code: "미래코드" }));
    expect(state.error).toEqual({ code: "미래코드", message: "응답을 받지 못했습니다." });
    expect(state.retryable).toBeNull();
  });

  it("turn_cancelled 는 cancelled 로 가고 승인을 치운다", () => {
    const state = fold(
      started,
      frame(2, "tool_approval_request", { approvalId: "a1", toolCallId: "c1", tool: "w" }),
      frame(3, "turn_cancelled", { turnId: "t1" })
    );
    expect(state).toMatchObject({ phase: "cancelled", pendingApproval: null });
  });
});

describe("stream_resync", () => {
  it("커서를 그 번호까지 올리고 연결은 유지한다", () => {
    const state = fold(started, frame(900, "stream_resync", {}));
    expect(state).toMatchObject({ seq: 900, needsResync: true });
  });

  it("본문을 버린다 — 바닥 아래가 안 오므로 앞뒤가 이어 붙으면 구멍이 안 보인다", () => {
    const state = fold(
      started,
      frame(2, "token", { delta: "앞" }),
      frame(900, "stream_resync", {})
    );
    expect(answerText(state.blocks)).toBe("");
  });

  /**
   * ★ **버리는 것은 본문뿐이다.** 위 검사는 「버렸나」의 반쪽만 본다 — 리듀서가 블록을
   * 통째로 비워도 `answerText` 는 똑같이 빈 문자열이라 초록이다.
   *
   * 과정 레일은 남아야 한다. **무엇을 하다 밀렸는지가 사유의 절반**이고, 본문과 달리
   * 도구·생각 블록은 히스토리 재조회가 `TOOL`·`THINKING` 행으로 다시 그려 주므로
   * 여기서 지우면 같은 것이 두 벌 그려진다.
   */
  it("★ 과정 레일은 남긴다 — 도구와 생각은 안 버린다", () => {
    const state = fold(
      started,
      frame(2, "thinking_delta", { text: "전사에서 찾습니다" }),
      frame(3, "tool_call_start", {
        toolCallId: "call_01",
        tool: "transcripts.search",
      }),
      frame(4, "token", { delta: "앞" }),
      frame(900, "stream_resync", {})
    );

    expect(state.blocks.map((block) => block.kind)).toEqual([
      "thinking",
      "tool",
    ]);
  });
});

describe("endStream — 닫힘 자체는 상태가 아니다", () => {
  it("종료 프레임 없이 닫히면 아무것도 안 바꾼다 — 재연결이 받는다", () => {
    const flowing = fold(started, frame(2, "token", { delta: "안" }));
    expect(endStream(flowing, "closed")).toBe(flowing);
  });

  // ★ 승인 카드가 정지 화면에 덮이던 결함
  it("승인 대기의 EOF 도 정상 종료다", () => {
    const waiting = fold(
      started,
      frame(2, "tool_approval_request", { approvalId: "a1", toolCallId: "c1", tool: "w" })
    );
    expect(endStream(waiting, "closed").phase).toBe("awaiting_approval");
  });

  it("포기는 기존 오류 배너에 접힌다 — 새 상태를 안 만든다", () => {
    const flowing = fold(started, frame(2, "token", { delta: "안" }));
    const gaveUp = endStream(flowing, "gaveUp");
    expect(gaveUp).toMatchObject({ phase: "failed", retryable: true });
    expect(gaveUp.error?.code).toBe("STREAM_INTERRUPTED");
  });

  it("이미 끝난 턴은 포기로 안 덮는다", () => {
    const done = fold(started, frame(2, "message_end", { messageId: "m", content: "답" }));
    expect(endStream(done, "gaveUp")).toBe(done);
  });
});

describe("도구 인자 — 두 전송이 두 모양으로 준다", () => {
  /**
   * ★ 라이브의 `tool_call_start.args` 는 ai 가 내서 **객체**이고, 재진입의
   * `activeTurn.pendingApproval.args` 는 server 가 `jsonb` 를 Kotlin `String` 으로 들고
   * 있다가 그대로 내보내서 **JSON 문자열**이다.
   *
   * 접기 전에는 문자열을 `Object.entries` 에 넣어 **문자 인덱스가 행으로 섰다** —
   * 카드에 `0: {`, `1: "` 가 그려졌다.
   */
  it("★ JSON 문자열로 와도 객체로 접는다", () => {
    expect(toolArgs('{"title":"배포 게이트","teamId":"T1"}')).toEqual({
      title: "배포 게이트",
      teamId: "T1",
    });
  });

  it("객체로 오면 그대로 쓴다", () => {
    expect(toolArgs({ title: "배포 게이트" })).toEqual({ title: "배포 게이트" });
  });

  it("깨진 JSON 은 인자 없음으로 접는다 — 카드는 summary 만으로 선다", () => {
    expect(toolArgs("{입력이 깨졌다")).toBeNull();
  });

  it("배열과 null 은 인자가 아니다", () => {
    expect(toolArgs("[1,2]")).toBeNull();
    expect(toolArgs(null)).toBeNull();
  });
});

describe("복원", () => {
  it("승인이 실려 있으면 승인 대기로 선다 — status 이름을 안 본다", () => {
    const state = resumedState({
      cursor: 42,
      turnId: "t1",
      pendingApproval: { approvalId: "a1", tool: "w", summary: null, args: null },
    });
    expect(state).toMatchObject({ phase: "awaiting_approval", seq: 42, turnId: "t1" });
  });

  it("승인이 없으면 흐르는 중이고 content 를 안 세운다", () => {
    const state = resumedState({ cursor: 42, turnId: "t1", pendingApproval: null });
    expect(state).toMatchObject({ phase: "streaming", content: null });
    expect(state.blocks).toEqual([]);
  });

  it("실패로 끝난 마지막 턴은 배너를 세운다", () => {
    expect(failedTurnState("TURN_TIMEOUT", true)).toMatchObject({
      phase: "failed",
      retryable: true,
      error: { code: "TURN_TIMEOUT" },
    });
  });
});
