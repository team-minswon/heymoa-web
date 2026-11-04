import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApprovalCard } from "@/components/chat/approval-card";
import { ChatThread } from "@/components/chat/chat-thread";
import { intlWrapper } from "@/components/help/test-intl";
import {
  failedTurnState,
  initialStreamState,
} from "@/lib/chat/stream-protocol";

const HANGUL = /[가-힣]/;

function renderFailed(code: string, locale: "ko" | "en") {
  return render(
    <ChatThread
      messages={[]}
      stream={failedTurnState(code, true)}
      pendingUserMessage={null}
      onApprove={vi.fn()}
    />,
    { wrapper: intlWrapper(locale) }
  );
}

describe("채팅 영어 화면", () => {
  it("실패 배너는 코드로 문구를 고르고 영어 화면에 한글이 없다", () => {
    const { container } = renderFailed("SERVICE_RESTARTING", "en");
    expect(screen.getByText("Couldn't generate a response")).toBeTruthy();
    expect(
      screen.getByText(
        "The response stopped because the server restarted. Send your message again."
      )
    ).toBeTruthy();
    expect(container.textContent).not.toMatch(HANGUL);
  });

  it("모르는 실패 코드는 기본 문구로 접힌다", () => {
    renderFailed("SOMETHING_NEW", "ko");
    expect(screen.getByText("응답을 받지 못했습니다.")).toBeTruthy();
  });

  it("서버 문구가 있으면 코드보다 먼저 쓴다", () => {
    render(
      <ChatThread
        messages={[]}
        stream={{
          ...initialStreamState,
          phase: "failed",
          error: { code: "UPSTREAM_ERROR", message: "서버가 고른 문구" },
        }}
        pendingUserMessage={null}
        onApprove={vi.fn()}
      />,
      { wrapper: intlWrapper("en") }
    );
    expect(screen.getByText("서버가 고른 문구")).toBeTruthy();
  });

  it("승인 카드의 버튼·배지·안내가 영어다", () => {
    const { container } = render(
      <ApprovalCard
        card={{
          title: "Create task",
          target: null,
          warning: null,
          fields: [
            {
              label: "Due",
              value: null,
              before: null,
              after: "Friday",
              added: [],
              removed: [],
              kept: [],
            },
          ],
          items: [],
          body: { label: null, text: "Prepare the slides" },
        }}
        summary={null}
        status={{ kind: "open" }}
      />,
      { wrapper: intlWrapper("en") }
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
    expect(screen.getByText("Needs approval")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(container.textContent).not.toMatch(HANGUL);
  });
});
