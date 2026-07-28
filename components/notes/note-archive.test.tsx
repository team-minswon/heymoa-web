import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteArchive } from "@/components/notes/note-archive";

const data = vi.hoisted(() => ({
  segments: [] as unknown[],
  messages: [] as unknown[],
  transcriptFails: false,
  chatFails: false,
}));

vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  useGetNoteTranscript: () => ({
    isPending: false,
    isError: data.transcriptFails,
    refetch: () => {},
    data: data.transcriptFails
      ? undefined
      : {
          status: 200,
          data: { success: true, data: { segments: data.segments } },
        },
  }),
}));
vi.mock("@/lib/api/generated/note-shared-chat/note-shared-chat", () => ({
  useGetNoteSharedChatMessages: () => ({
    isError: data.chatFails,
    refetch: () => {},
    data: data.chatFails
      ? undefined
      : {
          status: 200,
          data: {
            success: true,
            data: { chatId: "c", messages: data.messages, lock: null },
          },
        },
  }),
}));

describe("NoteArchive", () => {
  afterEach(() => {
    cleanup();
    data.segments = [];
    data.messages = [];
    data.transcriptFails = false;
    data.chatFails = false;
  });

  it("전사와 공유 Q&A를 함께 병치한다", () => {
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 3000,
        text: "배포 일정을 정합시다.",
      },
    ];
    data.messages = [
      {
        messageId: "u1",
        createdAt: "2026-07-24T00:00:00Z",
        role: "USER",
        content: "결정된 것만 정리해줘",
        authorName: "홍길동",
        toolEvent: null,
      },
      {
        messageId: "a1",
        createdAt: "2026-07-24T00:00:01Z",
        role: "ASSISTANT",
        content: "배포는 금요일로 정했습니다.",
        authorName: null,
        toolEvent: null,
      },
    ];
    render(<NoteArchive noteId="01K0000000002" />);

    expect(screen.getByText("배포 일정을 정합시다.")).toBeTruthy();
    expect(screen.getByText("회의 중 챗봇 대화")).toBeTruthy();
    expect(screen.getByText("결정된 것만 정리해줘")).toBeTruthy();
    expect(screen.getByText("배포는 금요일로 정했습니다.")).toBeTruthy();
    expect(screen.getByText("홍길동")).toBeTruthy();
  });

  it("전사 로드 실패를 빈 아카이브가 아니라 오류·재시도로 보인다", () => {
    data.transcriptFails = true;
    render(<NoteArchive noteId="01K0000000002" />);
    expect(screen.getByText("전사를 불러오지 못했습니다.")).toBeTruthy();
    expect(screen.queryByText("전사된 대화가 없습니다.")).toBeNull();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  it("Q&A 로드 실패를 빈 섹션으로 삼키지 않는다", () => {
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 1000,
        text: "회의 내용.",
      },
    ];
    data.chatFails = true;
    render(<NoteArchive noteId="01K0000000002" />);
    expect(screen.getByText("챗봇 대화를 불러오지 못했습니다.")).toBeTruthy();
    // 전사 실패와 같은 재시도 경로를 준다.
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  it("공유 Q&A가 없으면 Q&A 섹션을 그리지 않는다", () => {
    data.segments = [
      {
        segmentId: "s1",
        transcriptionSessionId: "sess1",
        sequence: 0,
        startedAtMs: 0,
        endedAtMs: 1000,
        text: "짧은 회의.",
      },
    ];
    render(<NoteArchive noteId="01K0000000002" />);
    expect(screen.getByText("짧은 회의.")).toBeTruthy();
    expect(screen.queryByText("회의 중 챗봇 대화")).toBeNull();
  });

  it("모바일은 본문 하단 여백을 줄이고 데스크톱 독 여백은 유지한다", () => {
    render(<NoteArchive noteId="01K0000000002" />);

    const content = screen.getByRole("region", {
      name: "회의 전사 아카이브",
    }).parentElement!;
    expect(content.classList.contains("pb-7")).toBe(true);
    expect(content.classList.contains("sm:pb-9")).toBe(true);
    expect(content.classList.contains("lg:pb-28")).toBe(true);
    expect(content.classList.contains("pb-28")).toBe(false);
  });

  describe("맨 아래로", () => {
    function renderScrollable({ scrollTop = 0, scrollHeight = 1_000 } = {}) {
      data.segments = [
        {
          segmentId: "s1",
          transcriptionSessionId: "sess1",
          sequence: 0,
          startedAtMs: 0,
          endedAtMs: 1000,
          text: "긴 회의.",
        },
      ];
      const view = render(<NoteArchive noteId="01K0000000002" />);
      const viewport = view.container.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      );
      Object.defineProperties(viewport!, {
        scrollTop: { configurable: true, writable: true, value: scrollTop },
        scrollHeight: { configurable: true, value: scrollHeight },
        clientHeight: { configurable: true, value: 400 },
      });
      return { ...view, viewport: viewport! };
    }

    it("바닥에 있으면 안 보인다", () => {
      const { viewport } = renderScrollable({ scrollTop: 600 });
      fireEvent.scroll(viewport);
      expect(screen.queryByRole("button", { name: "맨 아래로" })).toBeNull();
    });

    it("위로 올리면 뜬다 — 종료된 회의라고 되돌아갈 길이 없으면 안 된다", () => {
      const { viewport } = renderScrollable({ scrollTop: 0 });
      fireEvent.scroll(viewport);
      expect(screen.getByRole("button", { name: "맨 아래로" })).toBeTruthy();
    });

    it("모바일 버튼은 콘텐츠 가까이에 두고 데스크톱에서만 독을 피한다", () => {
      const { viewport } = renderScrollable({ scrollTop: 0 });
      fireEvent.scroll(viewport);

      const overlay = screen.getByRole("button", {
        name: "맨 아래로",
      }).parentElement!;
      expect(overlay.classList.contains("bottom-4")).toBe(true);
      expect(overlay.classList.contains("lg:bottom-20")).toBe(true);
      expect(overlay.classList.contains("bottom-20")).toBe(false);
    });

    it("눌러 바닥으로 간다. 자동으로 따라가지는 않는다", () => {
      const { viewport } = renderScrollable({ scrollTop: 0 });
      fireEvent.scroll(viewport);
      fireEvent.click(screen.getByRole("button", { name: "맨 아래로" }));

      // 정적 문서라 마운트 시 튀면 안 되고, 명령을 받았을 때만 내려간다.
      expect(viewport.scrollTop).toBe(1_000);
      expect(screen.queryByRole("button", { name: "맨 아래로" })).toBeNull();
    });
  });
});
