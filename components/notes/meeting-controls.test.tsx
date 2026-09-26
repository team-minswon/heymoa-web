import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MeetingControls,
  MeetingStatusChip,
} from "@/components/notes/meeting-controls";
import type { NoteResponseData } from "@/lib/api/generated/models";

const state = vi.hoisted(() => ({
  userId: "user-12345",
  activeNoteId: null as string | null,
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: state.userId, name: "테스트 유저" } }),
}));
vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    isNoteRecordingActive: actual.isNoteRecordingActive,
    useRecording: () => ({
      activeNoteId: state.activeNoteId,
      phase: state.activeNoteId ? "recording" : "idle",
      session: null,
    }),
  };
});
vi.mock("@/components/notes/meeting-end-dialog", () => ({
  MeetingEndDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="end-dialog" /> : null,
}));

function note(overrides: Partial<NoteResponseData>): NoteResponseData {
  return {
    noteId: "01K0000000002",
    title: "주간 회의",
    projectId: "01K0000000001",
    createdAt: "2026-07-24T00:00:00Z",
    updatedAt: "2026-07-24T00:00:00Z",
    meetingStatus: "IN_PROGRESS",
    meetingStartedBy: {
      userId: "user-12345",
      name: "테스트 유저",
      email: "test@heymoa.com",
      image: null,
    },
    meetingStartedAt: "2026-07-24T00:00:00Z",
    recordedDurationMs: 65_000,
    activeSessionStartedAt: "2026-07-24T00:01:00Z",
    ...overrides,
  } as NoteResponseData;
}

const renderControls = (n: NoteResponseData) =>
  render(<MeetingControls note={n} />);

describe("MeetingStatusChip", () => {
  afterEach(cleanup);

  it("기록 중만 붉게 낸다 — 나머지 상태는 사건이 아니라 상태다", () => {
    const { rerender } = render(<MeetingStatusChip status="IN_PROGRESS" />);
    expect(screen.getByText("기록 중")).toHaveClass("text-destructive");

    rerender(<MeetingStatusChip status="ENDED" />);
    expect(screen.getByText("종료됨")).not.toHaveClass("text-destructive");
  });

  it("라벨은 목록 행과 같은 이름을 쓴다", () => {
    const { rerender } = render(<MeetingStatusChip status="NOT_STARTED" />);
    expect(screen.getByText("시작 전")).toBeInTheDocument();

    rerender(<MeetingStatusChip status="PAUSED" />);
    expect(screen.getByText("중지됨")).toBeInTheDocument();
  });
});

describe("MeetingControls", () => {
  beforeEach(() => {
    state.userId = "user-12345";
    state.activeNoteId = null;
  });
  afterEach(cleanup);

  it("기록 중이면 회의 종료만 내놓는다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(screen.getByRole("button", { name: "회의 종료" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    // 상태 칩은 헤더 첫 줄로, 초 단위 타이머는 레코더 독으로 갔다.
    expect(screen.queryByText("기록 중")).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
  });

  // APP-694: 서버가 기록 중인 회의의 종료를 409 MEETING_RECORDING 으로 거절한다.
  it("기록 중이면 회의 종료를 잠그고 이 창의 녹음자에게는 중지부터 하라고 알린다", () => {
    state.activeNoteId = "01K0000000002";
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    const end = screen.getByRole("button", { name: "회의 종료" });
    expect(end).toBeDisabled();
    expect(end).toHaveAccessibleDescription("중지한 뒤 종료할 수 있습니다");
  });

  it("다른 사람이 기록 중이면 누가 기록 중인지 알린다", () => {
    state.userId = "user-other";
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    const end = screen.getByRole("button", { name: "회의 종료" });
    expect(end).toBeDisabled();
    expect(end).toHaveAccessibleDescription(
      "테스트 유저 님이 기록 중 — 중지한 뒤 종료할 수 있습니다"
    );
  });

  it("시작자를 모르면 이름 없이 알린다", () => {
    renderControls(
      note({ meetingStatus: "IN_PROGRESS", meetingStartedBy: null })
    );

    expect(
      screen.getByRole("button", { name: "회의 종료" })
    ).toHaveAccessibleDescription("중지한 뒤 종료할 수 있습니다");
  });

  it("잠긴 버튼 위에서도 툴팁이 뜬다", async () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    // disabled 버튼은 포인터 이벤트를 안 내므로 감싼 요소가 트리거다.
    fireEvent.pointerEnter(
      screen.getByRole("button", { name: "회의 종료" }).parentElement!,
      { pointerType: "mouse" }
    );
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "회의 종료" }).parentElement!
    );

    expect(
      await screen.findByText(
        "테스트 유저 님이 기록 중 — 중지한 뒤 종료할 수 있습니다",
        {
          selector:
            "[data-slot=tooltip-content] *, [data-slot=tooltip-content]",
        }
      )
    ).toBeInTheDocument();
  });

  it("중지됨이면 누구나 회의를 끝낼 수 있다", () => {
    state.userId = "user-other";
    renderControls(
      note({ meetingStatus: "PAUSED", activeSessionStartedAt: null })
    );

    const end = screen.getByRole("button", { name: "회의 종료" });
    expect(end).toBeEnabled();
    expect(end).toHaveClass("h-8");
    fireEvent.click(end);
    expect(screen.getByTestId("end-dialog")).toBeTruthy();
  });

  // 시작만 누르고 소켓을 못 붙인 채 떠난 회의는 IN_PROGRESS 로 남는다. 서버는 활성 세션이 없으면
  // 종료를 받으므로(APP-694) 화면도 막지 않는다 — 막으면 아무도 끝낼 수 없다.
  it("기록 중이어도 활성 세션이 없으면 누구나 끝낼 수 있다", () => {
    state.userId = "user-other";
    renderControls(
      note({ meetingStatus: "IN_PROGRESS", activeSessionStartedAt: null })
    );

    expect(screen.getByRole("button", { name: "회의 종료" })).toBeEnabled();
  });

  // `요약 보기` 버튼은 없앴다 — 바로 위 탭 줄에 `요약`이 있어 같은 곳으로 가는 길이 둘이었다.
  it("종료·미시작에는 아무것도 내놓지 않는다", () => {
    const ended = render(
      <MeetingControls
        note={note({ meetingStatus: "ENDED", activeSessionStartedAt: null })}
        onMeetingEnded={vi.fn()}
      />
    );
    expect(ended.container.firstChild).toBeNull();
    cleanup();

    const notStarted = renderControls(
      note({
        meetingStatus: "NOT_STARTED",
        meetingStartedBy: null,
        meetingStartedAt: null,
        recordedDurationMs: 0,
        activeSessionStartedAt: null,
      })
    );
    expect(notStarted.container.firstChild).toBeNull();
  });
});
