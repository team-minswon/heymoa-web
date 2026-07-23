import { cleanup, render, screen } from "@testing-library/react";
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
      : { status: 200, data: { success: true, data: { segments: data.segments } } },
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
});
