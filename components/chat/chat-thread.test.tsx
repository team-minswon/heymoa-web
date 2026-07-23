import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatThread, type ThreadMessage } from "@/components/chat/chat-thread";
import { initialStreamState, type ChatStreamState } from "@/lib/chat/stream-protocol";

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
      isApprovalPending={false}
      {...props}
    />
  );
}

function streaming(overrides: Partial<ChatStreamState>): ChatStreamState {
  return { ...initialStreamState, phase: "streaming", ...overrides };
}

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

  it("공유 메시지의 작성자 이름을 USER 위에 보인다", () => {
    // 공유 챗봇은 멀티멤버라 누가 물었는지 보여야 한다. 개인 메시지에는 authorName이 없다.
    renderThread({
      messages: [
        message({ role: "USER", content: "배포 이슈 요약해줘", authorName: "홍길동" }),
      ],
    });
    expect(screen.getByText("홍길동")).toBeTruthy();
    expect(screen.getByText("배포 이슈 요약해줘")).toBeTruthy();
  });

  it("작성자 이름이 없으면(개인 챗봇) 이름을 그리지 않는다", () => {
    renderThread({ messages: [message({ role: "USER", content: "안녕" })] });
    // authorName 없이 렌더 — 이름 노드가 없다.
    expect(screen.getByText("안녕")).toBeTruthy();
  });

  it("decision이 있는 TOOL 메시지는 승인 기록으로 렌더한다", () => {
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
    expect(container.querySelector('[data-record="approval"]')).toBeTruthy();
    expect(container.querySelector('[data-record="call"]')).toBeNull();
  });

  it("status가 있는 TOOL 메시지는 실행 기록과 외부 링크로 렌더한다", () => {
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
    expect(container.querySelector('[data-record="call"]')).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "https://linear.app/heymoa/issue/APP-12"
    );
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
    expect(container.querySelector("[data-record]")).toBeNull();
    expect(screen.queryByText("정체 불명")).toBeNull();
  });

  it("스트리밍 중에는 지금까지의 토큰과 커서가 보인다", () => {
    const { container } = renderThread({ stream: streaming({ text: "만들던 중" }) });
    expect(screen.getByText(/만들던 중/)).toBeTruthy();
    expect(container.querySelector('[data-stream="cursor"]')).toBeTruthy();
  });

  it("error로 끝나면 부분 응답 없이 경고와 재전송만 남는다", () => {
    const onRetry = vi.fn();
    renderThread({
      stream: {
        ...initialStreamState,
        phase: "failed",
        text: "",
        error: { code: "LLM_PROVIDER_ERROR", message: "응답 생성에 실패했습니다." },
      },
      onRetry,
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "응답 생성에 실패했습니다."
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 보내기" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("종료 이벤트 없이 끊기면 부분 토큰을 회색으로 남긴다", () => {
    const { container } = renderThread({
      stream: { ...initialStreamState, phase: "stalled", text: "만들던 중" },
    });
    const partial = container.querySelector('[data-partial="true"]');
    expect(partial?.textContent).toContain("만들던 중");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("승인 대기 중에는 승인·거절 버튼이 보인다", () => {
    const onApprove = vi.fn();
    renderThread({
      stream: {
        ...initialStreamState,
        phase: "awaiting_approval",
        pendingApproval: {
          approvalId: "0K9GVJT2C4Q7F",
          tool: "linear.create_issue",
          summary: "Linear 이슈 'APP 버그 수정' 생성",
        },
        records: [
          {
            kind: "approval",
            approvalId: "0K9GVJT2C4Q7F",
            toolCallId: "call_02",
            tool: "linear.create_issue",
            summary: "Linear 이슈 'APP 버그 수정' 생성",
            decision: null,
          },
        ],
      },
      onApprove,
    });
    expect(screen.getByText("Linear 이슈 'APP 버그 수정' 생성")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    expect(onApprove).toHaveBeenCalledWith("REJECTED");
  });

  it("도구 실패 기록 아래로 토큰이 이어진다", () => {
    const { container } = renderThread({
      stream: streaming({
        text: "대신 이렇게 정리했습니다.",
        records: [
          {
            kind: "call",
            toolCallId: "call_01",
            tool: "linear.create_issue",
            summary: "이슈 생성 실패",
            status: "error",
            url: null,
          },
        ],
      }),
    });
    expect(container.querySelector('[data-record="call"]')).toBeTruthy();
    expect(screen.getByText(/대신 이렇게 정리했습니다./)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("앞 전송이 정리되기 전에는 재전송을 막는다", () => {
    // 유휴 타이머가 stalled로 표시한 순간에는 잠금이 아직 살아 있다. 여기서 누르면
    // 안내만 지워지고 재전송은 무시돼 고아 메시지가 남는다.
    renderThread({
      stream: { ...initialStreamState, phase: "stalled", text: "만들던 중" },
      isRetryDisabled: true,
    });
    expect(
      screen.getByRole("button", { name: "다시 보내기" })
    ).toHaveProperty("disabled", true);
  });

  it("메시지가 없고 흐르지 않으면 빈 상태를 보인다", () => {
    renderThread({ emptyState: <p>아직 시작된 대화가 없습니다</p> });
    expect(screen.getByText("아직 시작된 대화가 없습니다")).toBeTruthy();
  });
});
