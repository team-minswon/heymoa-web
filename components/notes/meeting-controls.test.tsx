import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MeetingControls,
  MeetingStatusChip,
  MeetingViewerChip,
} from "@/components/notes/meeting-controls";
import type { NoteResponseData } from "@/lib/api/generated/models";

const state = vi.hoisted(() => ({ userId: "user-12345" }));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: state.userId, name: "테스트 유저" } }),
}));
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

describe("MeetingViewerChip", () => {
  afterEach(cleanup);

  it("참관임을 라벨로 말한다 — 회의 제어가 없는 이유가 그 자리에 남아야 한다", () => {
    render(<MeetingViewerChip />);
    expect(screen.getByText("참관")).toBeInTheDocument();
  });
});

describe("MeetingControls", () => {
  beforeEach(() => {
    state.userId = "user-12345";
  });
  afterEach(cleanup);

  it("시작자 · 기록 중이면 회의 종료만 내놓는다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(screen.getByRole("button", { name: /회의 종료/ })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    // 상태 칩은 헤더 첫 줄로, 초 단위 타이머는 레코더 독으로 갔다.
    expect(screen.queryByText("기록 중")).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText("테스트 유저")).toBeNull();
  });

  it("중지됨에서도 시작자는 회의를 끝낼 수 있다", () => {
    renderControls(
      note({ meetingStatus: "PAUSED", activeSessionStartedAt: null })
    );

    expect(screen.getByRole("button", { name: "회의 종료" })).toHaveClass("h-8");
  });

  it("녹음 중에도 회의 종료가 잠기지 않는다", () => {
    // 녹음이 살아 있을 때의 차단·안내는 MeetingEndDialog가 소유한다(계약 409를 권위로 삼는다).
    // 여기서 미리 잠그면 다이얼로그가 사유를 보여줄 기회 자체가 없어진다.
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(
      screen.getByRole("button", { name: /회의 종료/ })
    ).not.toHaveProperty("disabled", true);
  });

  it("뷰어(시작자 아님)에게는 그룹째 없다", () => {
    state.userId = "user-other";

    const { container } = renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(container.firstChild).toBeNull();
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

  it("회의 종료를 누르면 확인 다이얼로그를 연다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    fireEvent.click(screen.getByRole("button", { name: /회의 종료/ }));

    expect(screen.getByTestId("end-dialog")).toBeTruthy();
  });
});
