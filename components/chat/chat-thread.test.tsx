import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatThread, type ThreadMessage } from "@/components/chat/chat-thread";
import {
  endStream,
  initialStreamState,
  reduceStreamEvent,
  type ChatStreamState,
} from "@/lib/chat/stream-protocol";

afterEach(cleanup);

function message(overrides: Partial<ThreadMessage>): ThreadMessage {
  return {
    createdAt: "2026-07-24T00:00:00Z",
    role: "USER",
    content: "내용",
    toolEvent: null,
    ...overrides,
  } as ThreadMessage;
}

function renderThread(
  props: Partial<React.ComponentProps<typeof ChatThread>> = {}
) {
  return render(
    <ChatThread
      messages={[]}
      stream={initialStreamState}
      pendingUserMessage={null}
      onRetry={vi.fn()}
      onApprove={vi.fn()}
      {...props}
    />
  );
}

function streaming(overrides: Partial<ChatStreamState>): ChatStreamState {
  return { ...initialStreamState, phase: "streaming", ...overrides };
}

/** 본문 한 덩이. 예전 헬퍼가 `text: "..."`로 주던 것과 같은 뜻이다. */
function body(text: string): ChatStreamState["blocks"] {
  return [{ kind: "text", text }];
}

/**
 * ★★ **[W-12] 왕복에서 구분선 개수가 안 변한다.**
 *
 * 「보내는 중」과 「답이 끝나 히스토리로 넘어간 뒤」를 같은 트리에서 갈아 끼우고 구분선을
 * 센다. 개수가 달라지면 그 차이만큼 아래가 밀린다 — 읽던 자리가 어긋난다.
 *
 * pending 이 구분선을 안 만들면 **보내는 중 0개 → 끝난 뒤 1개** 가 되어 여기서 걸린다.
 */
describe("★★ [W-12] 답이 히스토리로 넘어가도 화면이 안 밀린다", () => {
  /** 오늘 자정(보는 사람 시간대). 여기서 거꾸로 잡아야 검사가 실행 날짜에 안 매인다. */
  function todayMidnight() {
    const at = new Date();
    at.setHours(0, 0, 0, 0);
    return at.getTime();
  }
  const YESTERDAY_EVENING = new Date(todayMidnight() - 6 * 3_600_000);
  const TODAY_MORNING = new Date(todayMidnight() + 9 * 3_600_000);

  const HISTORY = [
    message({
      role: "USER",
      content: "지난 회의 정리해줘",
      createdAt: YESTERDAY_EVENING.toISOString(),
    }),
    message({
      role: "ASSISTANT",
      content: "세 가지가 남아 있었습니다.",
      createdAt: new Date(YESTERDAY_EVENING.getTime() + 8_000).toISOString(),
    }),
  ];

  function dividerTexts(container: HTMLElement) {
    return [
      ...container.querySelectorAll('[data-testid="thread-divider"]'),
    ].map((each) => each.textContent);
  }

  /** 보내는 중 → 끝난 뒤. 두 상태의 구분선을 돌려준다. */
  function roundTrip(askedAt: string) {
    const sending = (
      <ChatThread
        messages={HISTORY}
        stream={initialStreamState}
        pendingUserMessage="그럼 두 번째는?"
        pendingUserAt={askedAt}
        onRetry={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    const { container, rerender } = render(sending);
    const before = dividerTexts(container);

    // 히스토리로 넘어간다. **질문의 시각은 보낼 때 쓴 값 그대로다** — 패널이 그것을
    // 얼려서 넘긴다(`frozenMessages`).
    rerender(
      <ChatThread
        messages={[
          ...HISTORY,
          message({
            role: "USER",
            content: "그럼 두 번째는?",
            createdAt: askedAt,
          }),
          message({
            role: "ASSISTANT",
            content: "두 번째는 배포 일정입니다.",
            createdAt: new Date(Date.parse(askedAt) + 6_000).toISOString(),
          }),
        ]}
        stream={initialStreamState}
        pendingUserMessage={null}
        pendingUserAt={askedAt}
        onRetry={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    return { before, after: dividerTexts(container) };
  }

  it("★ 날이 바뀐 질문 — 보내는 순간부터 구분선이 서 있다", () => {
    const { before, after } = roundTrip(TODAY_MORNING.toISOString());

    expect(before).toHaveLength(2);
    expect(after).toEqual(before);
  });

  it("같은 날 이어 물으면 구분선이 안 늘고, 그것도 왕복에서 그대로다", () => {
    const { before, after } = roundTrip(
      new Date(YESTERDAY_EVENING.getTime() + 2 * 3_600_000).toISOString()
    );

    expect(before).toHaveLength(1);
    expect(after).toEqual(before);
  });
});

describe("ChatThread", () => {
  it("유저와 어시스턴트 메시지를 렌더한다", () => {
    renderThread({
      messages: [
        message({ role: "USER", content: "지난 회의 정리해줘" }),
        message({ role: "ASSISTANT", content: "이렇게 정리했습니다." }),
      ],
    });
    expect(screen.getByText("지난 회의 정리해줘")).toBeTruthy();
    expect(screen.getByText("이렇게 정리했습니다.")).toBeTruthy();
  });

  it("작성자 이름이 없으면(개인 챗봇) 이름을 그리지 않는다", () => {
    renderThread({ messages: [message({ role: "USER", content: "안녕" })] });
    // authorName 없이 렌더 — 이름 노드가 없다.
    expect(screen.getByText("안녕")).toBeTruthy();
  });

  it("decision이 있는 TOOL 메시지는 스트림과 같은 승인 단계로 렌더한다", () => {
    const { container } = renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "테스트 유저님이 승인",
          toolEvent: {
            tool: "linear.create_issue",
            decision: "APPROVED",
            status: null,
            url: null,
          },
        }),
      ],
    });
    expect(container.querySelector('[data-step="approval"]')).toBeTruthy();
    expect(container.querySelector('[data-step="tool"]')).toBeNull();
    // ★ 카드는 사람 말(`summary`)로 물었다. 계약이 그 말을 저장하지 않는다고 여기서
    // 도구 id를 대면, 같은 한 번의 일을 두 화면이 다른 이름으로 부르게 된다.
    expect(screen.queryByText(/linear\.create_issue/)).toBeNull();
    // 「테스트 유저님이 승인」(content)도 안 쓴다 — 「승인함」과 같은 말이다.
    expect(screen.queryByText(/테스트 유저님이 승인/)).toBeNull();
    expect(screen.getByText("승인함")).toBeTruthy();
  });

  it("status가 있는 TOOL 메시지는 스트림과 같은 도구 단계로 렌더한다", () => {
    const { container } = renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "APP-12 생성됨",
          toolEvent: {
            tool: "linear.create_issue",
            decision: null,
            status: "success",
            url: "https://linear.app/heymoa/issue/APP-12",
          },
        }),
      ],
    });
    expect(container.querySelector('[data-step="tool"]')).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "https://linear.app/heymoa/issue/APP-12"
    );
  });

  it("끝난 도구 기록은 내부 식별자도 상태 배지도 세우지 않는다", () => {
    // 예전에는 히스토리에서만 흰 카드가 서서 `linear.create_issue`가 제목이었고
    // 「완료」 배지가 붙었다 — 기록에 늘 같은 값이 붙으니 아무것도 말하지 않는다.
    renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "전사에서 관련 발화 검색 · 3건 찾음",
          toolEvent: {
            tool: "transcripts.search",
            decision: null,
            status: "success",
            url: null,
          },
        }),
      ],
    });
    expect(screen.getByText("전사에서 관련 발화 검색 · 3건 찾음")).toBeTruthy();
    expect(screen.queryByText("transcripts.search")).toBeNull();
    expect(screen.queryByText("완료")).toBeNull();
  });

  it("연이은 TOOL 기록은 한 묶음으로 접힌다", () => {
    // 흐르는 동안 한 묶음이던 것이 새로고침 뒤 낱개 카드로 흩어지면 안 된다.
    const { container } = renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "테스트 유저님이 승인",
          toolEvent: {
            tool: "linear.create_issue",
            decision: "APPROVED",
            status: null,
            url: null,
          },
        }),
        message({
          role: "TOOL",
          content: "APP-12 생성됨",
          toolEvent: {
            tool: "linear.create_issue",
            decision: null,
            status: "success",
            url: null,
          },
        }),
      ],
    });
    expect(container.querySelectorAll('[data-cot="group"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-cot="single"]')).toHaveLength(0);
  });

  it("decision도 status도 없는 TOOL 메시지는 그리지 않는다", () => {
    // 계약상 둘은 배타다. 한쪽만 검사하면 계약 밖 형태가 반대쪽으로 새어 든다.
    const { container } = renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "정체 불명",
          toolEvent: { tool: "x", decision: null, status: null, url: null },
        }),
      ],
    });
    expect(container.querySelector("[data-step]")).toBeNull();
    expect(screen.queryByText("정체 불명")).toBeNull();
  });

  it("스트리밍 중에는 낱말이 각자의 요소로 선다", () => {
    // 통짜 문장이면 `getByText` 로 찾히겠지만, 그러면 새로 붙은 낱말만 떠오르게 할 수
    // 없다. **커서는 없다** — 물결처럼 떠오르는 것이 이미 「지금 오고 있다」를 말한다.
    const { container } = renderThread({
      stream: streaming({ blocks: body("만들던 중") }),
    });
    const bubble = container.querySelector('[data-testid="assistant-message"]');
    expect(bubble?.textContent).toContain("만들던 중");
    expect(bubble?.className).toContain("chat-streaming");
    expect(container.querySelectorAll(".md-w").length).toBeGreaterThan(1);
    expect(container.querySelector('[data-stream="cursor"]')).toBeNull();
  });

  it("답이 끝나면 낱말이 다시 안 움직인다", () => {
    // 클래스만 뗀다. 구조를 바꾸면 DOM 이 통째로 다시 마운트돼 답 전체가 한꺼번에
    // 떠오른다.
    const { container } = renderThread({
      messages: [message({ role: "ASSISTANT", content: "확정된 답입니다." })],
    });
    const bubble = container.querySelector('[data-testid="assistant-message"]');
    expect(bubble?.className ?? "").not.toContain("chat-streaming");
  });

  it("★ [W-09] 말풍선에는 이름도 시각도 안 붙는다 — 시각은 구분선만 말한다", () => {
    // 말풍선의 시각은 서버가 저장한 뒤에야 오므로, 붙이면 답이 끝나는 순간 없던 줄이
    // 끼어들어 읽던 자리가 밀린다. 구분선은 **질문 시각**이라 답이 끝나는 것과 무관하다.
    const { container } = renderThread({
      messages: [
        message({ role: "USER", content: "정한 게 뭐야" }),
        message({ role: "ASSISTANT", content: "금요일입니다." }),
      ],
    });
    expect(screen.queryByText("HeyMoa")).toBeNull();

    const bubbles = [
      screen.getByText("정한 게 뭐야"),
      screen.getByTestId("assistant-message"),
    ];
    for (const bubble of bubbles) {
      expect(bubble.textContent).not.toMatch(/\d{1,2}:\d{2}/);
    }

    // 구분선은 하나 서고, 시각은 거기 있다.
    const dividers = container.querySelectorAll(
      '[data-testid="thread-divider"]'
    );
    expect(dividers).toHaveLength(1);
    expect(dividers[0].textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it("error로 끝나면 부분 응답 없이 경고와 재전송만 남는다", () => {
    const onRetry = vi.fn();
    renderThread({
      stream: {
        ...initialStreamState,
        phase: "failed",
        blocks: [],
        error: {
          code: "LLM_PROVIDER_ERROR",
          message: "응답 생성에 실패했습니다.",
        },
      },
      onRetry,
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "응답 생성에 실패했습니다."
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 보내기" }));
    expect(onRetry).toHaveBeenCalled();
  });

  /**
   * 재연결을 다 쓰고 포기한 자리. **`turn_failed`와 같은 `failed`이지만 본문이 남아
   * 있다** — server가 실패를 선언하면 본문 블록을 걷으므로, 남아 있다는 것이
   * 「선언된 실패가 아니라 끊긴 것」의 표시다.
   */
  it("재연결을 포기하면 부분 토큰을 회색으로 남긴다", () => {
    const { container } = renderThread({
      stream: {
        ...initialStreamState,
        phase: "failed",
        blocks: body("만들던 중"),
        retryable: true,
        error: { code: "STREAM_INTERRUPTED", message: "응답이 중간에 끊겼습니다." },
      },
    });
    const partial = container.querySelector('[data-partial="true"]');
    expect(partial?.textContent).toContain("만들던 중");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  const openCard = {
    tool: "linear.create_issue",
    summary: "Linear 이슈 'APP 버그 수정' 생성",
    args: null,
    state: { kind: "open" as const },
  };

  it("승인 대기 중에는 승인·거절 버튼이 보인다", () => {
    const onApprove = vi.fn();
    renderThread({ approvalCard: openCard, onApprove });
    expect(screen.getByText("Linear 이슈 'APP 버그 수정' 생성")).toBeTruthy();
    // 만료가 없다는 문구가 있다. 「중지」가 유일한 탈출구다.
    expect(screen.getByText(/답할 때까지 기다립니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    expect(onApprove).toHaveBeenCalledWith("REJECTED");
  });

  it("★ 카드에 도구 id 를 안 적는다 — summary 가 제목이다", () => {
    // `linear.create_issue` 는 기계 이름이고, 바로 아래 줄이 같은 말을 사람 말로 더 잘 했다.
    const { container } = renderThread({ approvalCard: openCard });

    expect(container.textContent).not.toContain("linear.create_issue");
    expect(screen.getByTestId("approval-summary").textContent).toBe(
      "Linear 이슈 'APP 버그 수정' 생성"
    );
    // 되돌릴 수 있느냐를 말하는 배지는 남는다.
    expect(screen.getByText("쓰기 도구")).toBeTruthy();
  });

  it("★ summary 가 null 이면 그때만 도구 id 를 대신 세운다", () => {
    // 계약이 nullable 이다. 비면 배지와 버튼만 남아 **무엇을 승인하는지 모르는 채** 누르게 된다.
    renderThread({ approvalCard: { ...openCard, summary: null } });

    expect(screen.getByTestId("approval-summary").textContent).toBe(
      "승인이 필요한 도구: linear.create_issue"
    );
    expect(screen.getByRole("button", { name: "승인" })).toBeTruthy();
  });

  it("submitted면 버튼을 잠그고 확정 대기 문구를 보인다", () => {
    renderThread({
      approvalCard: { ...openCard, state: { kind: "submitted" } },
    });
    expect(screen.getByRole("button", { name: "승인" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByRole("button", { name: "거절" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByText(/확정은 응답이 재개되면/)).toBeTruthy();
  });

  it("invalidated면 버튼을 지우고 사유를 보인다", () => {
    const { container } = renderThread({
      approvalCard: {
        ...openCard,
        state: {
          kind: "invalidated",
          reason: "이미 처리됐거나 지나간 승인입니다.",
        },
      },
    });
    expect(
      container.querySelector('[data-approval="invalidated"]')
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
    expect(screen.queryByRole("button", { name: "거절" })).toBeNull();
    expect(screen.getByText("이미 처리됐거나 지나간 승인입니다.")).toBeTruthy();
  });

  it("도구 실패 기록 아래로 토큰이 이어진다", () => {
    const { container } = renderThread({
      stream: streaming({
        blocks: [
          {
            kind: "tool",
            toolCallId: "call_01",
            tool: "linear.create_issue",
            summary: "이슈 생성 실패",
            target: null,
            args: null,
            status: "error",
            url: null,
          },
          { kind: "text", text: "대신 이렇게 정리했습니다." },
        ],
      }),
    });
    expect(container.querySelector('[data-step="tool"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="assistant-message"]')?.textContent
    ).toContain("대신 이렇게 정리했습니다.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("앞 전송이 정리되기 전에는 재전송을 막는다", () => {
    // 유휴 타이머가 stalled로 표시한 순간에는 잠금이 아직 살아 있다. 여기서 누르면
    // 안내만 지워지고 재전송은 무시돼 고아 메시지가 남는다.
    renderThread({
      stream: {
        ...initialStreamState,
        phase: "cancelled",
        blocks: body("만들던 중"),
      },
      isRetryDisabled: true,
    });
    expect(screen.getByRole("button", { name: "다시 보내기" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("지난 질문이 그때 쓴 범위를 들고 있다", () => {
    // 범위는 대화가 아니라 턴이 든다. 여기가 비면 스크롤을 올렸을 때 모든 질문이
    // 범위 없이 보이고, 계약이 DB까지 실어 나른 값이 화면에서 사라진다.
    //
    // 나가는 문장에는 칩이 마커로 남는다(`MentionInput.read`). 화면은 그 자리를
    // 읽어 칩으로 되돌린다.
    renderThread({
      messages: [
        message({
          role: "USER",
          content: "@[주간 배포 회의](noteId:n1)에서 정한 게 뭐야",
          scope: [
            {
              kind: "NOTE",
              id: "n1",
              title: "주간 배포 회의",
              unavailable: false,
            },
          ],
        }),
      ],
    });
    // 문장 안에 칩으로 박힌다 — 입력에서 보던 그 모양 그대로다.
    const chip = document.querySelector('[data-scope-chip="note"]');
    expect(chip?.textContent).toBe("주간 배포 회의");
  });

  it("★ 말풍선의 칩을 누르면 그 회의록으로 간다", () => {
    // **이것이 마커를 실어 보내는 이유다.** 제목만 나가던 시절에는 id 가 없어
    // `onOpenNote` 를 못 걸었고, 정작 그 아래 「찾은 곳」은 눌러서 회의록으로 갔다 —
    // 사용자가 지목한 것은 못 가고 에이전트가 찾은 것은 갔다.
    const onOpenNote = vi.fn();
    renderThread({
      onOpenNote,
      messages: [
        message({
          role: "USER",
          content: "@[주간 배포 회의](noteId:n1) 정리해줘",
          scope: [
            {
              kind: "NOTE",
              id: "n1",
              title: "주간 배포 회의",
              unavailable: false,
            },
          ],
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /주간 배포 회의/ }));
    expect(onOpenNote).toHaveBeenCalledWith("n1");
  });

  it("★ 마커에 있어도 범위 배열에 없는 id 는 칩으로 안 그린다", () => {
    // 사용자가 문장에 손으로 마커를 칠 수 있다. 권한은 배열이 쥐므로 안전하지만
    // **화면이 없는 것을 있는 것처럼 그리면 안 된다** — 글자 그대로 남는다.
    renderThread({
      messages: [
        message({
          role: "USER",
          content: "@[아무거나](noteId:xxxx) 정리해줘",
          scope: [
            { kind: "NOTE", id: "n1", title: "주간 배포 회의", unavailable: false },
          ],
        }),
      ],
    });

    expect(document.querySelector("[data-scope-chip]")).toBeNull();
    expect(screen.getByText(/@\[아무거나\]\(noteId:xxxx\)/)).toBeTruthy();
  });

  it("★ 괄호가 든 제목도 마커에서 온전히 나온다", () => {
    // 「알림 정책 논의 (2차)」 같은 제목이 실제로 있다. 이스케이프 규칙이 어긋나면
    // 여기서 제목이 반쪽으로 잘리거나 파싱이 통째로 실패한다.
    renderThread({
      messages: [
        message({
          role: "USER",
          content: "@[알림 정책 논의 (2차)](noteId:n9) 정리해줘",
          scope: [
            {
              kind: "NOTE",
              id: "n9",
              title: "알림 정책 논의 (2차)",
              unavailable: false,
            },
          ],
        }),
      ],
    });

    expect(
      document.querySelector('[data-scope-chip="note"]')?.textContent
    ).toBe("알림 정책 논의 (2차)");
  });

  it("★ 마커가 없는 옛 메시지는 제목 탐색으로 되돌린다", () => {
    // 이미 쌓인 대화에는 마커가 없다. 파서가 둘 다 받아야 옛 대화가 안 깨진다.
    // 그 길에서는 「회고」가 먼저 걸리면 「스프린트 회고」가 반쪽으로 잘린다.
    renderThread({
      messages: [
        message({
          role: "USER",
          content: "스프린트 회고 와 회고 를 비교해줘",
          scope: [
            {
              kind: "NOTE",
              id: "n1",
              title: "스프린트 회고",
              unavailable: false,
            },
            { kind: "NOTE", id: "n2", title: "회고", unavailable: false },
          ],
        }),
      ],
    });
    expect(
      [...document.querySelectorAll("[data-scope-chip]")].map(
        (each) => each.textContent
      )
    ).toEqual(["스프린트 회고", "회고"]);
  });

  it("★ 옛 메시지의 칩은 못 누른다 — 동명 회의록을 못 가른다", () => {
    // 제목으로만 이어진 문장은 「주간 회의」가 셋일 때 어느 것인지 모른다.
    // 아무 데로나 보내는 것보다 안 보내는 쪽이 낫다.
    const onOpenNote = vi.fn();
    renderThread({
      onOpenNote,
      messages: [
        message({
          role: "USER",
          content: "주간 배포 회의에서 정한 게 뭐야",
          scope: [
            { kind: "NOTE", id: "n1", title: "주간 배포 회의", unavailable: false },
          ],
        }),
      ],
    });

    expect(screen.queryByRole("button", { name: /주간 배포 회의/ })).toBeNull();
    expect(document.querySelector('[data-scope-chip="note"]')).toBeTruthy();
  });

  /**
   * ★ **히스토리의 `kind` 는 대문자다.** server 가 도메인 enum 을 그대로 내고, SSE 는
   * ai 가 내서 소문자다 — 같은 필드가 두 전송에서 두 모양이라 화면이 접는다.
   *
   * 접기가 없던 동안 `=== "project"` 를 못 지나 **프로젝트가 회의록 칩으로** 그려졌고,
   * 마커가 붙으면 `kind` 대조가 어긋나 **칩이 아예 안 그려졌다.** 둘 다 안 터져서
   * 검사도 화면도 멀쩡해 보였다 — 프로젝트 칩을 덮는 검사가 하나도 없었다.
   */
  it("★ 프로젝트 범위가 프로젝트 칩으로 그려진다 — 대소문자를 접는다", () => {
    renderThread({
      messages: [
        message({
          role: "USER",
          content: "@[결제 개편](projectId:p1) 쪽 얘기 정리해줘",
          scope: [
            { kind: "PROJECT", id: "p1", title: "결제 개편", unavailable: false },
          ],
        }),
      ],
    });

    expect(document.querySelector('[data-scope-chip="project"]')).toBeTruthy();
    expect(document.querySelector('[data-scope-chip="note"]')).toBeNull();
  });

  it("지워졌거나 권한을 잃은 범위는 칩으로 안 그린다", () => {
    // 제목이 없으니 문장에서 찾을 자리도 없다. 사용자가 쓴 글자는 그대로 남고 **살아
    // 있는 범위라는 표시만** 안 붙는다 — 없는 것을 있는 것처럼 그리는 쪽이 나쁘다.
    renderThread({
      messages: [
        message({
          role: "USER",
          content: "주간 배포 회의에서 정한 게 뭐야",
          scope: [{ kind: "NOTE", id: "n1", title: null, unavailable: true }],
        }),
      ],
    });
    expect(screen.getByText("주간 배포 회의에서 정한 게 뭐야")).toBeTruthy();
    expect(document.querySelector("[data-scope-chip]")).toBeNull();
  });

  it("히스토리의 답변도 근거 줄을 남긴다", () => {
    // 스트림이 끝나면 이 행이 라이브 말풍선을 대신한다. 안 그리면 「찾은 곳: …」이
    // 몇 초 떴다가 사라진다.
    renderThread({
      messages: [
        message({
          role: "ASSISTANT",
          content: "금요일입니다.",
          scope: [
            {
              kind: "NOTE",
              id: "n1",
              title: "주간 배포 회의",
              unavailable: false,
            },
          ],
        }),
      ],
    });
    expect(screen.getByText("찾은 곳: 주간 배포 회의 1건")).toBeTruthy();
  });

  it("쓸 수 없는 근거는 근거 줄에서 뺀다", () => {
    // 누를 수도 셀 수도 없는 것을 「1건」으로 세면 숫자가 거짓말이 된다.
    const { container } = renderThread({
      messages: [
        message({
          role: "ASSISTANT",
          content: "답",
          scope: [{ kind: "NOTE", id: "n1", title: null, unavailable: true }],
        }),
      ],
    });
    expect(container.querySelector('[data-refs="answer"]')).toBeNull();
  });

  it("메시지가 없고 흐르지 않으면 빈 상태를 보인다", () => {
    renderThread({ emptyState: <p>아직 시작된 대화가 없습니다</p> });
    expect(screen.getByText("아직 시작된 대화가 없습니다")).toBeTruthy();
  });
});

/**
 * ★ 화면 불변 가드.
 *
 * 턴 이벤트 다섯은 **기존 phase 여섯으로 접힌다.** 그래서 화면에 새로 생기는 것이 없어야
 * 한다 — 새 배너도 새 스피너도. `chat-thread.tsx`의 diff가 0인 것이 그 기계적 증거이고,
 * 여기서는 실제로 그려 보고 확인한다.
 */
describe("턴 이벤트가 화면을 안 바꾼다", () => {
  function reduce(events: { event: string; data: string }[]) {
    return events.reduce(
      (state, event) => reduceStreamEvent(state, event),
      initialStreamState
    );
  }

  function frame(event: string, payload: unknown) {
    return { event, data: JSON.stringify(payload) };
  }

  const START = frame("message_start", { messageId: "01K0000000009" });

  function html(stream: ChatStreamState) {
    const { container } = renderThread({ stream });
    const markup = container.innerHTML;
    cleanup();
    return markup;
  }

  it("turn_started·stream_resync는 DOM을 하나도 안 늘린다", () => {
    // **resync를 토큰보다 앞에 둔다.** 그 뒤의 본문은 재생이 그리는 것이라 남고,
    // 앞의 본문은 구멍이 나서 걷힌다 — 여기서 보는 것은 「이 프레임 자신이 DOM을
    // 안 늘린다」 하나다.
    const plain = reduce([START, frame("token", { delta: "쓰던 중" })]);
    const withTurnEvents = reduce([
      frame("turn_started", { turnId: "01KTURN000001" }),
      frame("stream_resync", {}),
      START,
      frame("token", { delta: "쓰던 중" }),
    ]);

    expect(html(withTurnEvents)).toBe(html(plain));
  });

  /**
   * ★ **`error` 는 배너를 안 세운다.** 실패 코드를 정하는 것은 server 이고, ai 가 흘린
   * `error` 로 화면을 접으면 뒤따르는 `turn_failed` 의 코드를 못 받는다 — 사용자는
   * server 가 정한 사유 대신 ai 의 날문구를 본다(`프레임-처리표.md` 규칙 3).
   */
  it("error 하나로는 화면이 안 바뀐다 — 흐르던 그대로다", () => {
    const flowing = reduce([START, frame("token", { delta: "쓰던 중" })]);
    const afterError = reduceStreamEvent(
      flowing,
      frame("error", { code: "X", message: "ai 날문구" })
    );

    expect(html(afterError)).toBe(html(flowing));
  });

  it("배너는 turn_failed 가 세운다", () => {
    const byTurnFailed = reduce([
      START,
      frame("error", { code: "X", message: "ai 날문구" }),
      frame("turn_failed", { code: "UPSTREAM_ERROR", retryable: true }),
    ]);
    // ai 의 error 를 아예 안 본 경우와 같은 화면이어야 한다 — 그 문구는 안 쓴다.
    const withoutError = reduce([
      START,
      frame("turn_failed", { code: "UPSTREAM_ERROR", retryable: true }),
    ]);

    expect(html(byTurnFailed)).toBe(html(withoutError));
  });

  it("turn_cancelled는 중지와 같은 화면이다", () => {
    const streaming = reduce([START, frame("token", { delta: "절반" })]);
    const byEvent = reduceStreamEvent(streaming, frame("turn_cancelled", {}));

    expect(html(byEvent)).toBe(html(endStream(streaming, "cancelled")));
  });
});

/**
 * ★★ **[W-11] 흐를 때와 끝난 뒤가 같은 모양이다 — 생각도 포함해서.**
 *
 * 계약이 생각을 저장하기 전에는 새로고침 한 번에 **말이 사라지고 도구 뼈대만 남았다.**
 * 그때는 오류도 안 났다 — `HistoryMessage`가 모르는 role 에 `null`을 돌려주기 때문이다.
 */
describe("★★ [W-11] 히스토리에서도 생각이 보인다", () => {
  const TRACE = [
    message({ role: "USER", content: "결제 실패 얘기 있었어?" }),
    message({
      role: "THINKING",
      content: "전사에서 관련 발화를 찾습니다.",
      createdAt: "2026-07-24T00:00:02Z",
    }),
    message({
      role: "TOOL",
      content: "전사 검색 · 3건 찾음",
      createdAt: "2026-07-24T00:00:04Z",
      toolEvent: {
        tool: "transcripts.search",
        decision: null,
        status: "success",
        url: null,
      },
    }),
    message({
      role: "ASSISTANT",
      content: "두 회의에서 나왔습니다.",
      createdAt: "2026-07-24T00:00:06Z",
    }),
  ];

  it("THINKING 행이 도구와 같은 묶음의 한 줄로 선다", () => {
    const { container } = renderThread({ messages: TRACE });

    // 끝난 묶음은 접힌 채로 선다. 생각과 도구가 **한 묶음**이라 서랍도 하나다 —
    // 갈리면 레일이 두 개 서고, 그건 흐를 때와 다른 모양이다 [W-11].
    expect(container.querySelectorAll('[data-cot="group"]').length).toBe(1);

    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("전사에서 관련 발화를 찾습니다.")).toBeTruthy();
    // 스트림이 쓰던 그 줄이다 — 흰 카드로 갈아입지 않는다.
    expect(container.querySelector('[data-step="thinking"]')).toBeTruthy();
  });

  it("생각이 답변 말풍선으로 새지 않는다", () => {
    // 예전에는 계획 문장이 `token`으로 나가 답변 본문과 섞였다. 그 회귀를 여기서 막는다.
    renderThread({ messages: TRACE });

    const answer = screen.getByText("두 회의에서 나왔습니다.");
    expect(answer.textContent).not.toContain("전사에서 관련 발화를 찾습니다.");
  });

  it("★ 모르는 role 처럼 조용히 사라지지 않는다", () => {
    // `HistoryMessage` 는 USER·ASSISTANT 가 아니면 null 을 돌려준다. `groupHistory` 가
    // THINKING 을 안 집으면 그 행이 **오류 하나 없이** 화면에서 없어진다.
    const { container } = renderThread({
      messages: [message({ role: "THINKING", content: "혼자 남은 생각" })],
    });

    // 단계가 하나면 서랍을 안 만든다 — 접었다 폈다 할 것이 하나인 서랍은 서랍이 아니다.
    expect(container.querySelector('[data-cot="single"]')).toBeTruthy();
    expect(container.textContent).toContain("혼자 남은 생각");
  });
});

describe("승인 카드가 무엇을 승인하는지 보여준다", () => {
  const card = {
    tool: "linear.create_issue",
    summary: "Linear 이슈 생성",
    state: { kind: "open" as const },
  };

  it("인자를 이름-값 쌍으로 세운다 — 날 JSON 을 안 쏟는다", () => {
    renderThread({
      approvalCard: {
        ...card,
        args: { projectId: "0HZX2K7M9Q4AE", title: "APP 버그 수정" },
      },
    });

    const args = screen.getByTestId("approval-args");
    expect(args.textContent).toContain("projectId");
    expect(args.textContent).toContain("APP 버그 수정");
    // 통째로 stringify 하면 이 중괄호가 화면에 뜬다.
    expect(args.textContent).not.toContain('{"projectId"');
  });

  it("★ 인자가 없으면 그 자리를 아예 안 그린다", () => {
    // 빈 상자가 서면 「인자가 없는 것」과 「못 받은 것」이 화면에서 같아진다.
    renderThread({ approvalCard: { ...card, args: null } });
    expect(screen.queryByTestId("approval-args")).toBeNull();
  });

  it("★ 값이 비어 있는 줄은 빼고 나머지만 그린다", () => {
    renderThread({
      approvalCard: { ...card, args: { title: "제목", description: null } },
    });

    const args = screen.getByTestId("approval-args");
    expect(args.textContent).toContain("title");
    expect(args.textContent).not.toContain("description");
  });

  it("★ 긴 값은 접어 둔다 — 카드가 화면을 밀어내지 않는다", () => {
    const long = "가".repeat(200);
    const { container } = renderThread({
      approvalCard: { ...card, args: { description: long } },
    });

    const details = container.querySelector("details");
    expect(details).toBeTruthy();
    expect((details as HTMLDetailsElement).open).toBe(false);
    // 짧은 값은 접지 않는다 — 한 줄로 다 보이는 것을 굳이 누르게 하지 않는다.
    cleanup();
    const short = renderThread({
      approvalCard: { ...card, args: { title: "APP 버그 수정" } },
    });
    expect(short.container.querySelector("details")).toBeNull();
  });
});
