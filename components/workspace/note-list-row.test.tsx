import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteListRow } from "@/components/workspace/note-list-row";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

const recording = vi.hoisted(() => ({
  current: {
    session: {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    } as { sessionId: string; noteId: string; status: string } | null,
    activeNoteId: "01K0000000002" as string | undefined,
    phase: "recording",
    elapsedMs: 12_000,
  },
  meter: { levelHistory: [0.1, 0.25, 0.7, 0.4, 0.2] },
}));

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording.current,
  useRecordingMeter: () => recording.meter,
}));

function note(
  overrides: Partial<NoteListResponseDataNotesItem> = {}
): NoteListResponseDataNotesItem {
  return {
    noteId: "01K0000000002",
    projectId: "01K0000000001",
    title: "주간 제품 회의",
    createdAt: "2026-07-11T00:00:00Z",
    updatedAt: "2026-07-11T00:00:00Z",
    lastRecordedAt: "2026-07-11T00:00:00Z",
    recordedDurationMs: 65_000,
    activeSessionStartedAt: "2026-07-11T00:00:00Z",
    meetingStatus: "IN_PROGRESS",
    meetingStartedAt: "2026-07-11T00:00:00Z",
    meetingStartedBy: null,
    participants: [],
    ...overrides,
  };
}

function renderRow(row: NoteListResponseDataNotesItem, now?: number) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NoteListRow workspaceId="01K0000000000" note={row} now={now} />
    </QueryClientProvider>
  );
}

describe("NoteListRow", () => {
  afterEach(cleanup);
  beforeEach(() => {
    recording.current = {
      session: {
        sessionId: "01K0000000010",
        noteId: "01K0000000002",
        status: "ACTIVE",
      },
      activeNoteId: "01K0000000002",
      phase: "recording",
      elapsedMs: 12_000,
    };
    recording.meter = { levelHistory: [0.1, 0.25, 0.7, 0.4, 0.2] };
  });

  it("renders a flat row with a live meter while recording", () => {
    renderRow(note());

    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "주간 제품 회의 노트 열기" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("meter", { name: "주간 제품 회의 마이크 입력" })
    ).toBeInTheDocument();
  });

  it("shows no meter when the local recorder is inactive", () => {
    recording.current = {
      session: null,
      activeNoteId: undefined,
      phase: "completed",
      elapsedMs: 0,
    };
    recording.meter = { levelHistory: [0, 0, 0, 0, 0] };

    renderRow(note());

    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();
    // 로컬 녹음 여부와 서버 회의 상태는 별개다.
    expect(screen.queryByText("01:05")).toBeNull();
    expect(screen.getByText("기록 중")).toBeInTheDocument();
  });

  it.each([
    ["NOT_STARTED", "시작 전"],
    ["IN_PROGRESS", "기록 중"],
    ["PAUSED", "중지됨"],
    ["ENDED", "종료됨"],
  ] as const)("shows the exact %s status copy", (meetingStatus, label) => {
    recording.current = {
      session: null,
      activeNoteId: undefined,
      phase: "idle",
      elapsedMs: 0,
    };

    renderRow(
      note({
        meetingStatus,
        activeSessionStartedAt:
          meetingStatus === "IN_PROGRESS" ? "2026-07-11T00:22:41Z" : null,
        meetingStartedBy: {
          userId: "01K0000000099",
          name: "김민수",
          email: "minsu@heymoa.com",
          image: null,
        },
      }),
      Date.parse("2026-07-11T00:23:41Z")
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("uses cumulative active-only time instead of wall time since the first start", () => {
    renderRow(
      note({
        recordedDurationMs: 120_000,
        activeSessionStartedAt: "2026-07-11T00:22:41Z",
        meetingStartedAt: "2026-07-01T00:00:00Z",
        meetingStartedBy: {
          userId: "01K0000000099",
          name: "김민수",
          email: "minsu@heymoa.com",
          image: null,
        },
      }),
      Date.parse("2026-07-11T00:23:41Z")
    );

    expect(screen.getByText("기록 3분")).toBeInTheDocument();
    expect(screen.queryByText(/\d{4,}분/)).toBeNull();
  });

  it("freezes PAUSED duration and keeps its starter readable", () => {
    renderRow(
      note({
        meetingStatus: "PAUSED",
        activeSessionStartedAt: null,
        recordedDurationMs: 185_000,
        meetingStartedBy: {
          userId: "01K0000000099",
          name: "김민수",
          email: "minsu@heymoa.com",
          image: null,
        },
      }),
      Date.parse("2026-08-11T00:23:41Z")
    );

    expect(screen.getByText("중지됨")).toBeInTheDocument();
    // 진행자는 아바타 배지만으로 안 읽혀서 둘째 줄에 글자로도 적는다.
    // 진행자는 둘째 줄이 아니라 오른쪽 아바타 줄에서 구분선으로 갈라 선다.
    expect(screen.queryByText("김민수")).toBeNull();
    expect(
      screen.getByLabelText("진행자 김민수 (minsu@heymoa.com)")
    ).toBeInTheDocument();
    expect(screen.getByText("기록 3분")).toBeInTheDocument();
  });

  // 진행자가 참여자 명단에 없으면 예전에는 이미지를 빌릴 데가 없어, `email: ""`인 가짜
  // 객체로 떨어지고 아바타가 이름 첫 글자가 됐다. 계약이 meetingStartedBy에 email·image를
  // 실으면서 빌려오기 자체가 사라졌다 — **참여자 0명**이 그 회귀 조건이다.
  //
  // 이미지가 실제로 그려지는지는 여기서 못 본다. base-ui `Avatar.Image`는 브라우저가 로드를
  // 알려야 <img>를 붙이는데 jsdom은 그 신호를 안 준다. 대신 계약 객체가 손실 없이 그대로
  // 내려갔는지를 라벨의 이메일로 확인한다 — 옛 fallback은 여기가 비어 있었다.
  it("참여자가 아닌 진행자도 자기 계약 값 그대로 그린다", () => {
    renderRow(
      note({
        participants: [],
        meetingStartedBy: {
          userId: "01K0000000099",
          name: "김민수",
          email: "minsu@heymoa.com",
          image: "https://cdn.example.com/minsu.png",
        },
      }),
      Date.parse("2026-07-11T00:23:41Z")
    );

    expect(
      screen.getByLabelText("진행자 김민수 (minsu@heymoa.com)")
    ).toBeInTheDocument();
  });

  // 메타를 둘째 줄로 내리면서 화면 폭별 숨김을 걷어냈다 — 폭마다 행 구성이 달라지던 원인이다.
  // 진행자 이름만 좁은 화면에서 접는다(이름 길이를 알 수 없어 제목을 밀어낼 수 있다).
  // 배포 직후 남은 옛 응답·캐시에는 participants가 없다 — 여기서 죽으면 목록 전체가 빈다.
  it("participants가 없는 옛 응답에도 행이 그려진다", () => {
    const legacy = note();
    delete (legacy as { participants?: unknown }).participants;

    renderRow(legacy, Date.parse("2026-07-11T00:23:41Z"));

    expect(
      screen.getByRole("heading", { name: "주간 제품 회의" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/참여 \d+명/)).toBeNull();
  });

  it("모든 폭에서 상태·기록·시각을 같은 순서로 내고 제목 폭을 지킨다", () => {
    renderRow(
      note({
        recordedDurationMs: 120_000,
        activeSessionStartedAt: "2026-07-11T00:22:41Z",
        meetingStartedBy: {
          userId: "01K0000000099",
          name: "김민수",
          email: "minsu@heymoa.com",
          image: null,
        },
      }),
      Date.parse("2026-07-11T00:23:41Z")
    );

    const title = screen.getByRole("heading", { name: "주간 제품 회의" });
    const meta = screen.getByText("기록 중").parentElement;

    expect(title).toHaveClass("min-w-16", "truncate");
    expect(meta).toHaveClass("overflow-hidden");
    expect(screen.getByText("기록 중")).not.toHaveClass("hidden");
    expect(screen.getByText("기록 3분")).not.toHaveClass("hidden");
    // 이름과 구분점을 함께 접는다 — 이름만 접으면 점만 덩그러니 남는다.
    // 진행자 표식은 화면 폭으로 접지 않는다 — 접으면 모바일에서 알 방법이 사라진다.
    expect(
      screen.getByLabelText("진행자 김민수 (minsu@heymoa.com)")
    ).toBeInTheDocument();
  });
  it("기록 중이 아닌 회의는 메뉴에서 삭제할 수 있다", async () => {
    recording.current = {
      session: null,
      activeNoteId: undefined,
      phase: "idle",
      elapsedMs: 0,
    };
    renderRow(note({ meetingStatus: "ENDED", activeSessionStartedAt: null }));

    fireEvent.click(
      screen.getByRole("button", { name: "주간 제품 회의 노트 메뉴" })
    );

    await waitFor(() => {
      expect(screen.getByText("삭제")).toBeInTheDocument();
    });
  });

  it("기록 중인 회의에는 삭제를 안 그린다", async () => {
    renderRow(note({ meetingStatus: "IN_PROGRESS" }));

    fireEvent.click(
      screen.getByRole("button", { name: "주간 제품 회의 노트 메뉴" })
    );

    // 서버가 409로 막는 자리라 눌러서 실패하게 두지 않는다.
    await waitFor(() => {
      expect(screen.getByText("전체 화면")).toBeInTheDocument();
    });
    expect(screen.queryByText("삭제")).toBeNull();
  });
});
