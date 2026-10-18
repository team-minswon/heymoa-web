import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteContextSection } from "@/components/notes/note-context-section";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function noteReply(topic: string | null, background: string | null) {
  return new Response(
    JSON.stringify({
      success: true,
      data: { noteId: "N", contextTopic: topic, contextBackground: background },
      error: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function setup(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
  return { client, ...view };
}

describe("NoteContextSection", () => {
  it("입력을 멈추면 저장하고, 보내는 동안 더 쓴 것은 끝난 뒤 마지막 값 하나만 보낸다", async () => {
    const bodies: unknown[] = [];
    let release: () => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        if (bodies.length === 1) await new Promise<void>((r) => (release = r));
        return noteReply(body.topic, body.background);
      })
    );
    setup(
      <NoteContextSection
        noteId="N"
        phase="active"
        topic={null}
        background={null}
      />
    );
    const topic = screen.getByLabelText("주제");
    fireEvent.change(topic, { target: { value: "결제" } });
    fireEvent.blur(topic);
    await waitFor(() => expect(bodies).toHaveLength(1));
    fireEvent.change(topic, { target: { value: "결제 오" } });
    fireEvent.blur(topic);
    fireEvent.change(topic, { target: { value: "결제 오류 " } });
    fireEvent.blur(topic);
    release();
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ topic: "결제 오류", background: null });
    // 저장 응답이 입력란을 덮지 않는다(뒤 공백이 그대로)
    expect(topic).toHaveValue("결제 오류 ");
    await waitFor(() =>
      expect(screen.getByText("저장했어요")).toBeInTheDocument()
    );
  });

  it("고치는 중에는 서버 값이 바뀌어도 입력란을 되돌리지 않고, 손대지 않았으면 따라간다", () => {
    const { rerender } = setup(
      <NoteContextSection
        noteId="N"
        phase="active"
        topic="옛 주제"
        background={null}
      />
    );
    const topic = screen.getByLabelText("주제");
    const wrap = (value: string) => (
      <QueryClientProvider client={new QueryClient()}>
        <NoteContextSection
          noteId="N"
          phase="active"
          topic={value}
          background={null}
        />
      </QueryClientProvider>
    );
    rerender(wrap("남이 고친 주제"));
    expect(topic).toHaveValue("남이 고친 주제");

    fireEvent.focus(topic);
    fireEvent.change(topic, { target: { value: "내가 쓰는 중" } });
    rerender(wrap("또 바뀐 주제"));
    expect(screen.getByLabelText("주제")).toHaveValue("내가 쓰는 중");
  });

  it("녹음 중이면 본문에 안내를 두고, 종료된 회의는 값만 읽기로 보인다", () => {
    const { rerender } = setup(
      <NoteContextSection
        noteId="N"
        phase="active"
        topic={null}
        background={null}
      />
    );
    expect(
      screen.getByText(
        "녹음 중이에요. 고친 내용은 녹음을 다시 이어 갈 때부터 반영돼요."
      )
    ).toBeInTheDocument();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <NoteContextSection
          noteId="N"
          phase="ended"
          topic="주간 회의"
          background={null}
        />
      </QueryClientProvider>
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("주간 회의")).toBeInTheDocument();
    expect(screen.getByText("적지 않았어요")).toBeInTheDocument();
  });

  it("저장에 실패하면 입력을 지키고 다시 시도를 둔다", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            data: null,
            error: {
              code: "BAD_REQUEST",
              message: "잘못된 요청입니다.",
              details: null,
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    setup(
      <NoteContextSection
        noteId="N"
        phase="paused"
        topic={null}
        background={null}
      />
    );
    const background = screen.getByLabelText("배경");
    fireEvent.change(background, { target: { value: "배경 설명" } });
    fireEvent.blur(background);
    await waitFor(() =>
      expect(screen.getByText("저장하지 못했어요")).toBeInTheDocument()
    );
    expect(background).toHaveValue("배경 설명");
    expect(
      screen.getByRole("button", { name: "다시 시도" })
    ).toBeInTheDocument();
  });
});
