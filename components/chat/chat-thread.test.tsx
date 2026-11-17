import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messagesFor } from "@/i18n/messages";

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

function expandSteps() {
  for (const button of screen.queryAllByRole("button", {
    name: /생각/,
    expanded: false,
  }))
    fireEvent.click(button);
}

function renderThread(
  props: Partial<React.ComponentProps<typeof ChatThread>> = {},
  locale: "ko" | "en" = "ko"
) {
  return render(
    <ChatThread
      messages={[]}
      stream={initialStreamState}
      pendingUserMessage={null}
      onApprove={vi.fn()}
      {...props}
    />,
    {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
          {children}
        </NextIntlClientProvider>
      ),
    }
  );
}

function streaming(overrides: Partial<ChatStreamState>): ChatStreamState {
  return { ...initialStreamState, phase: "streaming", ...overrides };
}

function body(text: string): ChatStreamState["blocks"] {
  return [{ kind: "text", text }];
}

describe("★★ [W-12] 답이 히스토리로 넘어가도 화면이 안 밀린다", () => {
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

  function roundTrip(askedAt: string) {
    const sending = (
      <ChatThread
        messages={HISTORY}
        stream={initialStreamState}
        pendingUserMessage="그럼 두 번째는?"
        pendingUserAt={askedAt}
        onApprove={vi.fn()}
      />
    );
    const { container, rerender } = render(sending, {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="ko" messages={messagesFor("ko")}>
          {children}
        </NextIntlClientProvider>
      ),
    });
    const before = dividerTexts(container);

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

  describe("답 아래 손잡이", () => {
    it("★ 답에는 붙고 질문에는 안 붙는다", () => {
      const { container } = renderThread({
        messages: [
          message({ role: "USER", content: "지난 회의 정리해줘" }),
          message({ role: "ASSISTANT", content: "이렇게 정리했습니다." }),
        ],
      });
      expect(
        container.querySelectorAll('[data-testid="message-actions"]')
      ).toHaveLength(1);
    });

    it("★ 자리를 늘 잡아 둔다 — 손이 닿을 때 아래가 밀리면 안 된다", () => {
      const { container } = renderThread({
        messages: [
          message({ role: "ASSISTANT", content: "앞 답입니다." }),
          message({ role: "ASSISTANT", content: "답입니다." }),
        ],
      });
      const [earlier, last] = container.querySelectorAll(
        '[data-testid="message-actions"]'
      );
      expect(earlier.className).toContain("opacity-0");
      expect(earlier.className).toContain("group-hover/msg:opacity-100");
      expect(earlier.className).toContain("[@media(hover:none)]:opacity-100");
      expect(last.getAttribute("data-pinned")).toBe("true");
      expect(last.className).not.toContain("opacity-0");
    });

    it("복사를 누르면 그 답의 글이 클립보드로 간다", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      renderThread({
        messages: [
          message({ role: "ASSISTANT", content: "이렇게 정리했습니다." }),
        ],
      });

      fireEvent.click(screen.getByRole("button", { name: "복사" }));

      expect(writeText).toHaveBeenCalledWith("이렇게 정리했습니다.");
      await screen.findByRole("button", { name: "복사됨" });
      vi.unstubAllGlobals();
    });

    it("클립보드가 없는 환경에서도 안 터진다 — 안전하지 않은 출처가 그렇다", () => {
      vi.stubGlobal("navigator", {});
      renderThread({
        messages: [message({ role: "ASSISTANT", content: "답입니다." })],
      });

      expect(() =>
        fireEvent.click(screen.getByRole("button", { name: "복사" }))
      ).not.toThrow();
      vi.unstubAllGlobals();
    });

    it("★ 절대 시각이 아니라 상대 시각을 적는다", () => {
      const { container } = renderThread({
        messages: [
          message({
            role: "ASSISTANT",
            content: "방금 답",
            createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          }),
          message({
            role: "ASSISTANT",
            content: "지난 답",
            createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
          }),
        ],
      });

      const stamps = [
        ...container.querySelectorAll(
          '[data-testid="message-actions"] span:not(.sr-only)'
        ),
      ].map((node) => node.textContent ?? "");
      expect(stamps).toHaveLength(2);
      expect(stamps[0]).not.toBe(stamps[1]);
      expect(stamps.every((text) => text.trim().length > 0)).toBe(true);
      expect(stamps.some((text) => text.includes("2026"))).toBe(false);
    });
  });

  it("작성자 이름이 없으면(개인 챗봇) 이름을 그리지 않는다", () => {
    renderThread({ messages: [message({ role: "USER", content: "안녕" })] });
    expect(screen.getByText("안녕")).toBeTruthy();
  });

  it("decision이 있는 TOOL 메시지는 스트림과 같은 승인 카드로 렌더한다", () => {
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
            card: null,
          },
        }),
      ],
    });
    const card = container.querySelector('[data-testid="approval-card"]');
    expect(card?.getAttribute("data-approval")).toBe("check");
    expect(container.querySelector('[data-cot="group"]')).toBeNull();
    expect(screen.queryByText(/linear\.create_issue/)).toBeNull();
    expect(screen.queryByText(/테스트 유저님이 승인/)).toBeNull();
    expect(screen.getByText("변경 작업 승인")).toBeTruthy();
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
            card: null,
          },
        }),
      ],
    });
    expandSteps();
    expect(container.querySelector('[data-step="tool"]')).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "https://linear.app/heymoa/issue/APP-12"
    );
  });

  it("끝난 도구 기록은 내부 식별자도 상태 배지도 세우지 않는다", () => {
    renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "스크립트에서 관련 발화 검색 · 3건 찾음",
          toolEvent: {
            tool: "transcripts.search",
            decision: null,
            status: "success",
            url: null,
            card: null,
          },
        }),
      ],
    });
    expandSteps();
    expect(
      screen.getByText("스크립트에서 관련 발화 검색 · 3건 찾음")
    ).toBeTruthy();
    expect(screen.queryByText("transcripts.search")).toBeNull();
    expect(screen.queryByText("완료")).toBeNull();
  });

  it("★ 히스토리 승인 행이 card 를 실어 오면 새로고침 뒤에도 같은 카드다", () => {
    const { container } = renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "테스트 유저님이 승인",
          toolEvent: {
            tool: "heymoa_update_task",
            decision: "APPROVED",
            status: null,
            url: null,
            card: {
              title: "할 일 기한 바꾸기",
              target: "멘토링 · [시험] PRO-56 운영 확인",
              warning: null,
              fields: [
                {
                  label: "기한",
                  value: null,
                  before: "없음",
                  after: "2026-10-31",
                  added: null,
                  removed: null,
                  kept: null,
                },
              ],
              items: null,
              body: null,
            },
          },
        }),
        message({
          role: "TOOL",
          content: "할 일 기한을 바꿨습니다",
          toolEvent: {
            tool: "heymoa_update_task",
            decision: null,
            status: "success",
            url: null,
            card: null,
          },
        }),
      ],
      activeTurnId: null,
    });
    const card = container.querySelector('[data-testid="approval-card"]');
    expect(card?.getAttribute("data-approval")).toBe("done");
    expect(screen.getByTestId("approval-summary").textContent).toBe(
      "할 일 기한 바꾸기"
    );
    expect(card?.textContent).toContain("멘토링 · [시험] PRO-56 운영 확인");
    expect(card?.textContent).toContain("2026-10-31");
  });

  it("승인 뒤 결과 행은 카드의 상태가 된다 — 생각 과정에 쓰기 줄을 따로 세우지 않는다", () => {
    const { container } = renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "스크립트 검색 · 3건",
          toolEvent: {
            tool: "transcripts.search",
            decision: null,
            status: "success",
            url: null,
            card: null,
          },
        }),
        message({
          role: "TOOL",
          content: "테스트 유저님이 승인",
          toolEvent: {
            tool: "linear.create_issue",
            decision: "APPROVED",
            status: null,
            url: null,
            card: null,
          },
        }),
        message({
          role: "TOOL",
          content: "APP-12 생성됨",
          toolEvent: {
            tool: "linear.create_issue",
            decision: null,
            status: "success",
            url: "https://linear.app/heymoa/issue/APP-12",
            card: null,
          },
        }),
      ],
    });
    const card = container.querySelector('[data-testid="approval-card"]');
    expect(card?.getAttribute("data-approval")).toBe("done");
    expect(card?.textContent).toContain("APP-12 생성됨");
    expect(
      screen.getByRole("link", { name: /열기/ }).getAttribute("href")
    ).toBe("https://linear.app/heymoa/issue/APP-12");
    expandSteps();
    expect(container.querySelectorAll('[data-step="tool"]')).toHaveLength(1);
  });

  it("decision도 status도 없는 TOOL 메시지는 그리지 않는다", () => {
    const { container } = renderThread({
      messages: [
        message({
          role: "TOOL",
          content: "정체 불명",
          toolEvent: {
            tool: "x",
            decision: null,
            status: null,
            url: null,
            card: null,
          },
        }),
      ],
    });
    expect(container.querySelector("[data-step]")).toBeNull();
    expect(screen.queryByText("정체 불명")).toBeNull();
  });

  it("★ 흐르는 동안 글자에 아무것도 안 건다 — 통짜로 그린다", () => {
    const { container } = renderThread({
      stream: streaming({ blocks: body("만들던 중") }),
    });
    const bubble = container.querySelector('[data-testid="assistant-message"]');
    expect(bubble?.textContent).toContain("만들던 중");
    expect(bubble?.getAttribute("data-streaming")).toBe("true");
    expect(container.querySelector(".md-w")).toBeNull();
    expect(container.querySelector('[data-stream="cursor"]')).toBeNull();
  });

  it("★ 위에 옛 대화가 없으면 고정 턴이 위 여백을 안 이고 선다", () => {
    const { container } = renderThread({
      pendingUserMessage: "지난 회의에서 정한 것만 정리해줘",
      pendingUserAt: new Date().toISOString(),
      pinSlackPx: 600,
    });
    const pinned = container.querySelector('[data-testid="chat-pinned-turn"]');
    expect(pinned?.className).not.toContain("pt-6");
  });

  it("위에 옛 대화가 있으면 이고 선다 — 그때는 상자 위가 곧 뷰포트 위다", () => {
    const { container } = renderThread({
      messages: [
        message({ role: "USER", content: "앞 질문" }),
        message({ role: "ASSISTANT", content: "앞 답" }),
      ],
      pendingUserMessage: "다음 질문",
      pendingUserAt: new Date().toISOString(),
      pinSlackPx: 600,
    });
    const pinned = container.querySelector('[data-testid="chat-pinned-turn"]');
    expect(pinned?.className).toContain("pt-6");
  });

  it("히스토리 말풍선은 흐르는 중으로 안 찍힌다", () => {
    const { container } = renderThread({
      messages: [message({ role: "ASSISTANT", content: "확정된 답입니다." })],
    });
    const bubble = container.querySelector('[data-testid="assistant-message"]');
    expect(bubble?.getAttribute("data-streaming")).toBeNull();
  });

  it("★ [W-09] 말풍선에는 이름도 시각도 안 붙는다 — 시각은 구분선만 말한다", () => {
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

    const dividers = container.querySelectorAll(
      '[data-testid="thread-divider"]'
    );
    expect(dividers).toHaveLength(1);
    expect(dividers[0].textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it("error로 끝나면 부분 응답 없이 경고와 재전송만 남는다", () => {
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
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "응답 생성에 실패했습니다."
    );
    expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
  });

  it("재연결을 포기하면 부분 토큰을 회색으로 남긴다", () => {
    const { container } = renderThread({
      stream: {
        ...initialStreamState,
        phase: "failed",
        blocks: body("만들던 중"),
        retryable: true,
        error: {
          code: "STREAM_INTERRUPTED",
          message: "응답이 중간에 끊겼습니다.",
        },
      },
    });
    const partial = container.querySelector('[data-partial="true"]');
    expect(partial?.textContent).toContain("만들던 중");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  const openCard = {
    summary: "Linear 이슈 'APP 버그 수정' 생성",
    card: null,
    status: { kind: "open" as const },
  };

  it("승인 대기 중에는 승인·거절 버튼이 보인다", () => {
    const onApprove = vi.fn();
    renderThread({ approvalCard: openCard, onApprove });
    expect(screen.getByText("Linear 이슈 'APP 버그 수정' 생성")).toBeTruthy();
    expect(screen.getByText(/승인하거나 거절할 때까지 기다립니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    expect(onApprove).toHaveBeenCalledWith("REJECTED");
  });

  it("★ 카드에 도구 id 를 안 적는다 — summary 가 제목이다", () => {
    const { container } = renderThread({ approvalCard: openCard });

    expect(container.textContent).not.toContain("linear.create_issue");
    expect(screen.getByTestId("approval-summary").textContent).toBe(
      "Linear 이슈 'APP 버그 수정' 생성"
    );
    expect(screen.getByText("승인 대기")).toBeTruthy();
  });

  it("★ card 도 summary 도 없으면 승인을 막고 거절만 남긴다 — 도구 id 로 대신하지 않는다", () => {
    const { container } = renderThread({
      approvalCard: { ...openCard, summary: null },
    });

    expect(screen.getByTestId("approval-summary").textContent).toBe(
      "변경 작업 승인"
    );
    expect(screen.getByText(/무엇을 하는지 알 수 없어/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "승인" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByRole("button", { name: "거절" })).toHaveProperty(
      "disabled",
      false
    );
    expect(container.textContent).not.toContain("linear.create_issue");
  });

  it("submitted면 버튼을 잠그고 확정 대기 문구를 보인다", () => {
    renderThread({
      approvalCard: { ...openCard, status: { kind: "submitted" } },
    });
    expect(screen.getByRole("button", { name: "승인" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByRole("button", { name: "거절" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByText(/응답이 다시 이어지면 확정됩니다/)).toBeTruthy();
  });

  it("invalidated면 버튼을 지우고 사유를 보인다", () => {
    const { container } = renderThread({
      approvalCard: {
        ...openCard,
        status: {
          kind: "invalid",
          reason: "이미 처리됐거나 지나간 승인입니다.",
        },
      },
    });
    expect(container.querySelector('[data-approval="invalid"]')).toBeTruthy();
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
            status: "error",
            url: null,
          },
          { kind: "text", text: "대신 이렇게 정리했습니다." },
        ],
      }),
    });
    expandSteps();
    expect(container.querySelector('[data-step="tool"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="assistant-message"]')?.textContent
    ).toContain("대신 이렇게 정리했습니다.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("앞 전송이 정리되기 전에는 재전송을 막는다", () => {
    const { container } = renderThread({
      stream: {
        ...initialStreamState,
        phase: "cancelled",
        blocks: body("만들던 중"),
      },
    });
    expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      container.querySelector('[data-testid="assistant-message"]')?.className
    ).toContain("opacity-60");
  });

  it("지난 질문이 그때 쓴 범위를 들고 있다", () => {
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
    const chip = document.querySelector('[data-scope-chip="note"]');
    expect(chip?.textContent).toBe("주간 배포 회의");
  });

  it("★ 말풍선의 칩을 누르면 그 회의록으로 간다", () => {
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
    renderThread({
      messages: [
        message({
          role: "USER",
          content: "@[아무거나](noteId:xxxx) 정리해줘",
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

    expect(document.querySelector("[data-scope-chip]")).toBeNull();
    expect(screen.getByText(/@\[아무거나\]\(noteId:xxxx\)/)).toBeTruthy();
  });

  it("★ 괄호가 든 제목도 마커에서 온전히 나온다", () => {
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
    const onOpenNote = vi.fn();
    renderThread({
      onOpenNote,
      messages: [
        message({
          role: "USER",
          content: "주간 배포 회의에서 정한 게 뭐야",
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

    expect(screen.queryByRole("button", { name: /주간 배포 회의/ })).toBeNull();
    expect(document.querySelector('[data-scope-chip="note"]')).toBeTruthy();
  });

  it("★ 프로젝트 범위가 프로젝트 칩으로 그려진다 — 대소문자를 접는다", () => {
    renderThread({
      messages: [
        message({
          role: "USER",
          content: "@[결제 개편](projectId:p1) 쪽 얘기 정리해줘",
          scope: [
            {
              kind: "PROJECT",
              id: "p1",
              title: "결제 개편",
              unavailable: false,
            },
          ],
        }),
      ],
    });

    expect(document.querySelector('[data-scope-chip="project"]')).toBeTruthy();
    expect(document.querySelector('[data-scope-chip="note"]')).toBeNull();
  });

  it("지워졌거나 권한을 잃은 범위는 칩으로 안 그린다", () => {
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
    expect(
      screen.getByRole("group", { name: "참고한 회의록 1개" })
    ).toBeTruthy();
  });

  it("쓸 수 없는 근거는 근거 줄에서 뺀다", () => {
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
        card: null,
      },
    }),
    message({
      role: "ASSISTANT",
      content: "두 회의에서 나왔습니다.",
      createdAt: "2026-07-24T00:00:06Z",
    }),
  ];

  it("연달아 온 THINKING 은 한 줄로 잇는다", () => {
    const { container } = renderThread({
      messages: [
        message({
          role: "THINKING",
          content: "전사를 훑습니다.",
          createdAt: "2026-07-24T00:00:02Z",
        }),
        message({
          role: "THINKING",
          content: "\n찾은 것으로 정리합니다.",
          createdAt: "2026-07-24T00:00:03Z",
        }),
      ],
    });

    expandSteps();
    const rows = container.querySelectorAll('[data-step="thinking"]');
    expect([...rows].map((row) => row.textContent)).toEqual([
      "전사를 훑습니다.",
      "찾은 것으로 정리합니다.",
    ]);
  });

  it("사이에 도구가 끼면 안 잇는다", () => {
    const { container } = renderThread({
      messages: [
        message({
          role: "THINKING",
          content: "전사를 훑습니다.",
          createdAt: "2026-07-24T00:00:02Z",
        }),
        message({
          role: "TOOL",
          content: "전사 검색 · 3건",
          createdAt: "2026-07-24T00:00:03Z",
          toolEvent: {
            tool: "transcripts.search",
            decision: null,
            status: "success",
            url: null,
            card: null,
          },
        }),
        message({
          role: "THINKING",
          content: "찾은 것으로 정리합니다.",
          createdAt: "2026-07-24T00:00:04Z",
        }),
      ],
    });
    expandSteps();

    expect(container.querySelectorAll('[data-step="thinking"]')).toHaveLength(
      2
    );
  });

  it("TOOL 행의 scope 가 대상 칩으로 선다", () => {
    const onOpenNote = vi.fn();
    renderThread({
      onOpenNote,
      messages: [
        message({
          role: "THINKING",
          content: "회의록을 읽습니다.",
          createdAt: "2026-07-24T00:00:02Z",
        }),
        message({
          role: "TOOL",
          content: "회의록 읽기",
          createdAt: "2026-07-24T00:00:03Z",
          scope: [
            {
              kind: "NOTE",
              id: "0HZX2K7M9Q4AF",
              title: "주간 배포 회의",
              unavailable: false,
            },
          ],
          toolEvent: {
            tool: "notes.read",
            decision: null,
            status: "success",
            url: null,
            card: null,
          },
        }),
      ],
    });
    expandSteps();

    fireEvent.click(screen.getByRole("button", { name: /주간 배포 회의/ }));
    expect(onOpenNote).toHaveBeenCalledWith("0HZX2K7M9Q4AF");
  });

  it("제목을 잃은 대상은 칩을 안 세운다", () => {
    const { container } = renderThread({
      messages: [
        message({
          role: "THINKING",
          content: "회의록을 읽습니다.",
          createdAt: "2026-07-24T00:00:02Z",
        }),
        message({
          role: "TOOL",
          content: "회의록 읽기",
          createdAt: "2026-07-24T00:00:03Z",
          scope: [
            {
              kind: "NOTE",
              id: "0HZX2K7M9Q4AF",
              title: null,
              unavailable: true,
            },
          ],
          toolEvent: {
            tool: "notes.read",
            decision: null,
            status: "success",
            url: null,
            card: null,
          },
        }),
      ],
    });
    expandSteps();

    expect(container.querySelector("[data-target]")).toBeNull();
  });

  it("THINKING 행이 도구와 같은 묶음의 한 줄로 선다", () => {
    const { container } = renderThread({ messages: TRACE });

    expect(container.querySelectorAll('[data-cot="group"]').length).toBe(1);

    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("전사에서 관련 발화를 찾습니다.")).toBeTruthy();
    expect(container.querySelector('[data-step="thinking"]')).toBeTruthy();
  });

  it("생각이 답변 말풍선으로 새지 않는다", () => {
    renderThread({ messages: TRACE });

    const answer = screen.getByText("두 회의에서 나왔습니다.");
    expect(answer.textContent).not.toContain("전사에서 관련 발화를 찾습니다.");
  });

  it("★ 모르는 role 처럼 조용히 사라지지 않는다", () => {
    const { container } = renderThread({
      messages: [message({ role: "THINKING", content: "혼자 남은 생각" })],
    });

    expect(container.querySelector('[data-cot="group"]')).toBeTruthy();
    expandSteps();
    expect(container.textContent).toContain("혼자 남은 생각");
  });
});

describe("message_end 뒤의 근거 줄", () => {
  it("★ 답이 끝나면 히스토리를 기다리지 않고 근거 줄이 바로 선다", () => {
    renderThread({
      stream: {
        ...initialStreamState,
        phase: "done",
        content: "금요일입니다.",
        blocks: body("금요일입니다."),
        refs: [{ kind: "note", id: "n1", title: "주간 배포 회의" }],
      },
    });
    expect(
      screen.getByRole("group", { name: "참고한 회의록 1개" })
    ).toBeTruthy();
  });

  it("흐르는 중에는 아직 안 선다 — 결론을 미리 붙이지 않는다", () => {
    renderThread({
      stream: streaming({
        blocks: body("금요"),
        refs: [{ kind: "note", id: "n1", title: "주간 배포 회의" }],
      }),
    });
    expect(screen.queryByRole("group", { name: /참고한 회의록/ })).toBeNull();
  });
});

describe("★★ N3 끝난 턴의 도구 줄", () => {
  function frame(event: string, payload: unknown) {
    return { event, data: JSON.stringify(payload) };
  }
  function openSteps() {
    expandSteps();
  }

  it("실시간 — 결과 없이 실패하면 조회는 「중단됨」, 승인받은 쓰기는 「확인 필요」다", () => {
    const failed = [
      frame("message_start", { messageId: "01K0000000009" }),
      frame("tool_call_start", {
        toolCallId: "c1",
        tool: "transcripts.search",
        summary: "전사 검색",
      }),
      frame("tool_call_start", {
        toolCallId: "c2",
        tool: "linear.create_issue",
        summary: "이슈 생성",
      }),
      frame("tool_approval_request", {
        approvalId: "a2",
        toolCallId: "c2",
        tool: "linear.create_issue",
        summary: "이슈 생성",
      }),
      frame("tool_approval_resolved", {
        approvalId: "a2",
        decision: "APPROVED",
      }),
      frame("turn_failed", { code: "TURN_TIMEOUT", retryable: true }),
    ].reduce(
      (state, event) => reduceStreamEvent(state, event),
      initialStreamState
    );

    const { container } = renderThread({ stream: failed });
    openSteps();

    expect(screen.getByText("중단됨")).toBeTruthy();
    expect(screen.getByText("확인 필요")).toBeTruthy();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("실시간 — 재연결을 포기한 것은 턴이 끝난 것이 아니다 — 「중단됨」이 아니라 「확인 필요」다", () => {
    const flowing = [
      frame("message_start", { messageId: "01K0000000009" }),
      frame("tool_call_start", {
        toolCallId: "c1",
        tool: "transcripts.search",
        summary: "전사 검색",
      }),
    ].reduce(
      (state, event) => reduceStreamEvent(state, event),
      initialStreamState
    );

    const { container } = renderThread({
      stream: endStream(flowing, "gaveUp"),
    });
    expandSteps();
    expect(screen.queryByText("중단됨")).toBeNull();
    expect(screen.getByText("확인 필요")).toBeTruthy();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("실시간 — 흐르는 중에는 결과 없는 도구를 닫지 않는다", () => {
    const running = [
      frame("message_start", { messageId: "01K0000000009" }),
      frame("tool_call_start", {
        toolCallId: "c1",
        tool: "transcripts.search",
        summary: "전사 검색",
      }),
    ].reduce(
      (state, event) => reduceStreamEvent(state, event),
      initialStreamState
    );

    renderThread({ stream: running });
    expect(screen.queryByText("중단됨")).toBeNull();
  });

  const APPROVED_ONLY = [
    message({
      role: "USER",
      content: "이슈 만들어줘",
      turnId: "01KTURN000001",
    }),
    message({
      role: "TOOL",
      content: "테스트 유저님이 승인",
      turnId: "01KTURN000001",
      toolEvent: {
        tool: "linear.create_issue",
        decision: "APPROVED",
        status: null,
        url: null,
        card: null,
      },
    }),
  ];

  it("히스토리 — 끝난 턴의 결과 없는 승인 쓰기는 「확인 필요」다", () => {
    renderThread({ messages: APPROVED_ONLY, activeTurnId: null });
    expect(screen.getByText("확인 필요")).toBeTruthy();
  });

  it("히스토리 — 도는 턴의 행은 닫지 않는다", () => {
    renderThread({ messages: APPROVED_ONLY, activeTurnId: "01KTURN000001" });
    expect(screen.queryByText("확인 필요")).toBeNull();
  });

  it("히스토리 — 승인 뒤 결과가 있으면 그 결과가 짝이다", () => {
    renderThread({
      messages: [
        ...APPROVED_ONLY,
        message({
          role: "TOOL",
          content: "APP-12 생성됨",
          turnId: "01KTURN000001",
          toolEvent: {
            tool: "linear.create_issue",
            decision: null,
            status: "success",
            url: null,
            card: null,
          },
        }),
      ],
      activeTurnId: null,
    });
    expect(screen.queryByText("확인 필요")).toBeNull();
    expect(screen.getByText("완료")).toBeTruthy();
    expect(screen.getByText("APP-12 생성됨")).toBeTruthy();
  });
});

describe("★★ APP-1013 생각 과정 묶음", () => {
  const TURN = "01KTURN000009";
  const read = (at: string, content: string) =>
    message({
      role: "TOOL",
      turnId: TURN,
      content,
      createdAt: at,
      toolEvent: {
        tool: "transcripts.read",
        decision: null,
        status: "success",
        url: null,
        card: null,
      },
    });
  const HISTORY = [
    message({ role: "USER", content: "결제 실패?", turnId: TURN }),
    read("2026-07-24T00:00:02Z", "연관 스크립트 읽기 · 10:00"),
    read("2026-07-24T00:00:05Z", "연관 스크립트 읽기 · 10:01"),
  ];

  it("히스토리는 질문 시각부터 마지막 단계 행까지 걸린 시간을 말한다", () => {
    renderThread({ messages: HISTORY });
    expect(screen.getByText("5초 동안 생각")).toBeTruthy();
  });

  it("단계 행이 하나여도 질문 시각부터 잰다", () => {
    renderThread({ messages: HISTORY.slice(0, 2) });
    expect(screen.getByText("2초 동안 생각")).toBeTruthy();
  });

  it("걸린 시간을 모르면 시간 없이 「생각」이라 한다", () => {
    renderThread({ messages: HISTORY.slice(1, 2) });
    expect(screen.getByText("생각")).toBeTruthy();
    expect(screen.queryByText(/생각 과정/)).toBeNull();
  });

  it("커서로 이어받은 턴은 히스토리 단계와 스트림 단계가 한 묶음이다", () => {
    const { container } = renderThread({
      messages: HISTORY,
      activeTurnId: TURN,
      stream: streaming({
        turnId: TURN,
        blocks: [
          {
            kind: "tool",
            toolCallId: "c3",
            tool: "transcripts.read",
            summary: "연관 스크립트 읽기 · 10:02",
            target: null,
            status: "success",
            url: null,
          },
        ],
      }),
    });
    expect(container.querySelectorAll('[data-cot="group"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /생각 중/ }));
    expect(container.querySelector('[data-step="run"]')?.textContent).toContain(
      "×3"
    );
  });

  it("이어받은 뒤 승인을 물어도 한 묶음이다", () => {
    const { container } = renderThread({
      messages: HISTORY,
      activeTurnId: TURN,
      stream: {
        ...initialStreamState,
        phase: "awaiting_approval",
        turnId: TURN,
        blocks: [
          {
            kind: "tool",
            toolCallId: "c3",
            tool: "transcripts.read",
            summary: "연관 스크립트 읽기 · 10:02",
            target: null,
            status: "success",
            url: null,
          },
          {
            kind: "approval",
            approvalId: "a1",
            toolCallId: "w1",
            tool: "linear.create_issue",
            summary: "이슈 생성",
            card: null,
            decision: null,
          },
        ],
      },
    });
    expect(container.querySelectorAll('[data-cot="group"]')).toHaveLength(1);
  });
});

describe("APP-1436 재검사", () => {
  it("★ 상대 시각은 앱 언어로 적는다 — 한국어 화면에 「57m ago」가 섞이지 않는다", () => {
    const at = new Date(Date.now() - 57 * 60_000).toISOString();
    const stamp = (container: HTMLElement) =>
      container.querySelector(
        '[data-testid="message-actions"] span:not(.sr-only)'
      )?.textContent;
    const ko = renderThread({
      messages: [message({ role: "ASSISTANT", content: "답", createdAt: at })],
    });
    expect(stamp(ko.container)).toBe("57분 전");
    cleanup();
    const en = renderThread(
      {
        messages: [
          message({ role: "ASSISTANT", content: "답", createdAt: at }),
        ],
      },
      "en"
    );
    expect(stamp(en.container)).toMatch(/57.*ago/);
  });

  it("★ 멈춘 답은 끝에 「중지됨」이 선다 — 흐르다 멈춘 것도, 히스토리로 넘어간 것도", () => {
    renderThread({
      stream: {
        ...initialStreamState,
        phase: "cancelled",
        blocks: body("지금까지 확정된"),
      },
      pendingUserMessage: "정리해줘",
    });
    expect(screen.getByTestId("answer-stopped").textContent).toBe("중지됨");
    cleanup();

    renderThread({
      messages: [
        message({ role: "USER", content: "정리해줘", turnId: "t1" }),
        message({ role: "ASSISTANT", content: "지금까지", turnId: "t1" }),
      ],
      cancelledTurnId: "t1",
    });
    expect(screen.getByTestId("answer-stopped")).toBeTruthy();
    cleanup();

    renderThread({
      messages: [
        message({ role: "ASSISTANT", content: "다 받은 답", turnId: "t2" }),
      ],
      cancelledTurnId: "t1",
    });
    expect(screen.queryByTestId("answer-stopped")).toBeNull();
  });

  it("★ 범위·참고 칩은 제목을 자르지 않는다", () => {
    const long = "강상진 멘토님 특강 - 쿠버네티스_2 실습 환경과 포트 설정 정리";
    const { container } = renderThread({
      messages: [
        message({
          role: "USER",
          content: `@[${long}](noteId:0HZX2K7M9Q4AF) 정리`,
          scope: [
            {
              kind: "NOTE",
              id: "0HZX2K7M9Q4AF",
              title: long,
              unavailable: false,
            },
          ],
        }),
        message({
          role: "ASSISTANT",
          content: "답",
          scope: [
            {
              kind: "NOTE",
              id: "0HZX2K7M9Q4AF",
              title: long,
              unavailable: false,
            },
          ],
        }),
      ],
      onOpenNote: vi.fn(),
    });
    for (const chip of container.querySelectorAll(
      "[data-scope-chip], [data-refs] button"
    )) {
      expect(chip.textContent).toContain(long);
      expect(chip.innerHTML).not.toContain("truncate");
    }
  });
});
