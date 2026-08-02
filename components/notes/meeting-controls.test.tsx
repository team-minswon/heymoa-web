import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeetingControls } from "@/components/notes/meeting-controls";
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
    meetingStartedBy: { userId: "user-12345", name: "테스트 유저" },
    meetingStartedAt: "2026-07-24T00:00:00Z",
    recordedDurationMs: 65_000,
    activeSessionStartedAt: "2026-07-24T00:01:00Z",
    ...overrides,
  } as NoteResponseData;
}

const renderControls = (n: NoteResponseData, showContext?: boolean) =>
  render(<MeetingControls note={n} showContext={showContext} />);

describe("MeetingControls", () => {
  beforeEach(() => {
    state.userId = "user-12345";
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("시작자 · 기록 중이면 상태와 누적 시간과 회의 종료를 보인다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(screen.getByRole("button", { name: /회의 종료/ })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /중지/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /재개/ })).toBeNull();
    expect(screen.getByText("기록 중")).toBeInTheDocument();
    expect(screen.queryByText("테스트 유저")).toBeNull();
  });

  it("문맥 표시를 요청하면 시작자에게 상태와 시작자명과 종료를 함께 보인다", () => {
    renderControls(
      note({ meetingStartedBy: { userId: "user-12345", name: "김민수" } }),
      true
    );

    expect(screen.getByText("기록 중")).toBeTruthy();
    expect(screen.getByText("김민수").textContent).toBe(
      "김민수님이 시작한 회의"
    );
    expect(screen.getByRole("button", { name: /회의 종료/ })).toBeTruthy();
  });

  it("진행 중인 노트 상단은 누적 기록 시간을 초 단위로 갱신한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:23:41Z"));
    renderControls(
      note({
        meetingStartedAt: "2026-07-11T00:00:00Z",
        recordedDurationMs: 0,
        activeSessionStartedAt: "2026-07-11T00:00:00Z",
      })
    );
    act(() => vi.advanceTimersByTime(0));

    expect(
      screen.getByRole("timer", { name: "누적 기록 시간" })
    ).toHaveTextContent("23:41");

    act(() => vi.advanceTimersByTime(1_000));

    expect(
      screen.getByRole("timer", { name: "누적 기록 시간" })
    ).toHaveTextContent("23:42");
  });

  it("녹음 중에도 회의 종료가 잠기지 않는다", () => {
    // 녹음이 살아 있을 때의 차단·안내는 MeetingEndDialog가 소유한다(계약 409를 권위로 삼는다).
    // 여기서 미리 잠그면 다이얼로그가 사유를 보여줄 기회 자체가 없어진다.
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(
      screen.getByRole("button", { name: /회의 종료/ })
    ).not.toHaveProperty("disabled", true);
  });

  it("뷰어(시작자 아님)는 버튼 없이 상태와 시작자를 보인다", () => {
    state.userId = "user-other";

    renderControls(
      note({ meetingStartedBy: { userId: "user-12345", name: "김민수" } })
    );

    expect(screen.getByText("기록 중")).toBeTruthy();
    expect(screen.getByText("김민수").textContent).toBe(
      "김민수님이 시작한 회의"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("뷰어의 시작자 이름은 모바일에서도 보이고 전체 설명은 접근 가능하다", () => {
    state.userId = "user-other";

    renderControls(
      note({ meetingStartedBy: { userId: "user-12345", name: "김민수" } })
    );

    const name = screen.getByText("김민수");
    expect(name.classList.contains("hidden")).toBe(false);
    expect(name.classList.contains("truncate")).toBe(true);
    const description = screen.getByText("님이 시작한 회의");
    expect(description.classList.contains("sr-only")).toBe(true);
    expect(description.classList.contains("sm:not-sr-only")).toBe(true);
  });

  it("종료된 회의는 종료 상태와 누적 시간만 보인다", () => {
    renderControls(note({ meetingStatus: "ENDED" }));

    expect(screen.getByText("종료됨")).toBeTruthy();
    expect(screen.queryByText("테스트 유저")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("종료된 회의도 문맥 표시를 요청하면 시작자명을 보이되 종료 버튼은 두지 않는다", () => {
    renderControls(
      note({
        meetingStatus: "ENDED",
        meetingStartedBy: { userId: "user-12345", name: "김민수" },
      }),
      true
    );

    expect(screen.getByText("종료됨")).toBeTruthy();
    expect(screen.getByText("김민수").textContent).toBe(
      "김민수님이 시작한 회의"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("아직 시작 전이면 상태와 00:00을 그린다", () => {
    renderControls(
      note({
        meetingStatus: "NOT_STARTED",
        meetingStartedBy: null,
        meetingStartedAt: null,
        recordedDurationMs: 0,
        activeSessionStartedAt: null,
      })
    );

    expect(screen.getByText("시작 전")).toBeInTheDocument();
    expect(
      screen.getByRole("timer", { name: "누적 기록 시간" })
    ).toHaveTextContent("00:00");
  });

  it("회의 종료를 누르면 확인 다이얼로그를 연다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    fireEvent.click(screen.getByRole("button", { name: /회의 종료/ }));

    expect(screen.getByTestId("end-dialog")).toBeTruthy();
  });

  it("초마다 바뀌는 누적 타이머는 live region이 아니다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));

    expect(
      screen.getByRole("timer", { name: "누적 기록 시간" })
    ).not.toHaveAttribute("aria-live");
    expect(screen.queryByRole("status", { name: "누적 기록 시간" })).toBeNull();
  });

  it("서버 상태와 누적 기록 시간을 한 회의 제어 그룹에 표시한다", () => {
    renderControls(
      note({
        meetingStatus: "PAUSED",
        activeSessionStartedAt: null,
        recordedDurationMs: 65_000,
      })
    );

    expect(
      screen.getByRole("group", { name: "회의 상태 및 제어" })
    ).toBeInTheDocument();
    expect(screen.getByText("중지됨")).toBeInTheDocument();
    expect(
      screen.getByRole("timer", { name: "누적 기록 시간" })
    ).toHaveTextContent("01:05");
    expect(screen.getByRole("button", { name: "회의 종료" })).toHaveClass(
      "h-7"
    );
  });

  // `요약 보기` 버튼은 없앴다 — 바로 위 탭 줄에 `요약`이 있어 같은 곳으로 가는 길이 둘이었다.
  it("종료된 회의는 회의 종료도 요약 보기도 내놓지 않는다", () => {
    render(
      <MeetingControls
        note={note({
          meetingStatus: "ENDED",
          activeSessionStartedAt: null,
        })}
        onMeetingEnded={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "요약 보기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "회의 종료" })).toBeNull();
  });
});
