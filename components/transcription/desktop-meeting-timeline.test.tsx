import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setMeetingSelection } from "@/lib/desktop/meeting-selection";
import { ApiError } from "@/lib/api/fetcher";
import { DesktopMeetingTimelineReporter } from "./desktop-meeting-timeline";

const recording = vi.hoisted(() => ({
  value: { activeNoteId: null as string | null, phase: "idle" },
}));
const observeQuery = vi.hoisted(() => vi.fn());
const note = vi.hoisted(() => ({ meetingStatus: "IN_PROGRESS" }));
const queryState = vi.hoisted(() => ({ isError: false, dataUpdatedAt: 1 }));
const refetchNote = vi.hoisted(() =>
  vi.fn(async () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          title: "뷰어 회의",
          workspaceId: "w1",
          meetingStatus: "IN_PROGRESS",
        },
      },
    },
  }))
);

vi.mock("./recording-provider", () => ({
  useRecording: () => recording.value,
}));
vi.mock("@/components/notes/note-realtime-provider", () => ({
  NoteRealtimeProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useNoteRealtime: () => ({
    noteId: "n1",
    context: { state: { proposals: {} }, loading: false, failed: false },
    reconnecting: false,
    subscriptionIssue: null,
  }),
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNoteAgendas: () => ({
    data: { status: 200, data: { success: true, data: { agendas: [] } } },
  }),
  useGetNote: (_id: string, options?: unknown) => {
    if (options) observeQuery(options);
    return {
      ...queryState,
      refetch: refetchNote,
      data: {
        status: 200,
        data: { success: true, data: { title: "뷰어 회의", ...note } },
      },
    };
  },
}));
vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useGetAnalysisFlow: () => ({ data: undefined }),
}));
vi.mock("@/lib/api/generated/meeting-review/meeting-review", () => ({
  useGetMeetingReviewSummary: () => ({
    data: undefined,
    isPending: true,
    isError: false,
    refetch: () => Promise.resolve(),
  }),
}));
vi.mock("@/components/notes/use-live-partial", () => ({
  useLivePartial: () => ({ confirmedText: "현재 ", pendingText: "발언" }),
}));
vi.mock("@/lib/desktop/meeting-timeline", () => ({
  meetingTimelineSnapshot: (
    noteId: string,
    title: string,
    _state: unknown,
    _status: unknown,
    _label: unknown,
    detail?: unknown
  ) => ({ noteId, title, ...(detail ? { detail } : {}) }),
}));

const report = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  report.mockClear();
  observeQuery.mockClear();
  setMeetingSelection(null);
  refetchNote.mockReset().mockResolvedValue({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          title: "뷰어 회의",
          workspaceId: "w1",
          meetingStatus: "IN_PROGRESS",
        },
      },
    },
  });
  (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
    reportMeetingTimeline: report,
  };
  recording.value = { activeNoteId: null, phase: "idle" };
  note.meetingStatus = "IN_PROGRESS";
  queryState.isError = false;
  queryState.dataUpdatedAt = 1;
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { heymoaDesktop?: unknown }).heymoaDesktop;
});

describe("DesktopMeetingTimelineReporter 뷰어", () => {
  it("v2를 선언한 앱에만 검증한 선택의 안건과 실시간 전사를 전달합니다", async () => {
    setMeetingSelection({ noteId: "n1", workspaceId: "w1", requestId: 1 });
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
      reportMeetingTimeline: report,
      meetingTimelineVersion: 2,
    };
    render(<DesktopMeetingTimelineReporter />);
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            partial: { confirmedText: "현재 ", pendingText: "발언" },
            plan: expect.objectContaining({ list: { agendas: [] } }),
          }),
        })
      )
    );
  });
  it("내가 녹음하지 않아도 진행 중인 회의를 보고하고, 노트를 닫으면 지운다", () => {
    const { unmount } = render(<DesktopMeetingTimelineReporter />);
    expect(report).toHaveBeenCalledWith({ noteId: "n1", title: "뷰어 회의" });
    unmount();
    expect(report).toHaveBeenLastCalledWith(null);
  });

  it("끝난 회의는 보고하지 않는다", () => {
    note.meetingStatus = "ENDED";
    render(<DesktopMeetingTimelineReporter />);
    expect(report).not.toHaveBeenCalled();
  });

  it("내가 다른 노트를 녹음 중이면 그쪽이 메뉴 막대를 쓴다", () => {
    recording.value = { activeNoteId: "other", phase: "recording" };
    render(<DesktopMeetingTimelineReporter />);
    expect(report).not.toHaveBeenCalled();
  });
});

describe("DesktopMeetingTimelineReporter 보기 종료", () => {
  it("팝오버에서 보기를 끝내면 그 노트는 지우고 더 보고하지 않는다", async () => {
    let action: ((value: string) => void) | null = null;
    let open:
      | ((target: { workspaceId: string; noteId: string }) => void)
      | null = null;
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
      reportMeetingTimeline: report,
      subscribeOpenNote: (listener: typeof open) => {
        open = listener;
        return () => undefined;
      },
      subscribeRecordingActions: (listener: (value: string) => void) => {
        action = listener;
        return () => undefined;
      },
    };
    const { act } = await import("@testing-library/react");
    render(<DesktopMeetingTimelineReporter />);
    expect(report).toHaveBeenCalledWith({ noteId: "n1", title: "뷰어 회의" });
    report.mockClear();
    act(() => action?.("stop-viewing"));
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith(null);

    // 목록에서 같은 회의를 다시 고르면 다시 보고한다.
    report.mockClear();
    act(() => open?.({ workspaceId: "w1", noteId: "n1" }));
    expect(report).toHaveBeenCalledWith({ noteId: "n1", title: "뷰어 회의" });
  });
});

describe("선택한 회의의 권한과 녹음 정지", () => {
  it("일시적인 검증 실패는 재시도 상태로 알리고 새 성공 응답이 오면 같은 선택을 복구합니다", async () => {
    const unavailable = vi.fn().mockResolvedValue(undefined);
    refetchNote.mockRejectedValue(
      new ApiError(500, { code: "ERROR", message: "temporary" }, null)
    );
    setMeetingSelection({ noteId: "n1", workspaceId: "w1", requestId: 4 });
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
      meetingTimelineVersion: 2,
      reportMeetingTimeline: report,
      reportMeetingUnavailable: unavailable,
    };
    const screen = render(<DesktopMeetingTimelineReporter />);
    expect(report).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(unavailable).toHaveBeenCalledWith("n1", 4, true)
    );
    expect(report).not.toHaveBeenCalled();
    expect(
      observeQuery.mock.lastCall?.[0].query.refetchInterval({
        state: { error: null, status: "success" },
      })
    ).toBe(3000);
    queryState.dataUpdatedAt = 2;
    screen.rerender(<DesktopMeetingTimelineReporter />);
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: "n1",
          detail: expect.objectContaining({ selectionId: 4 }),
        })
      )
    );
    expect(
      observeQuery.mock.lastCall?.[0].query.refetchInterval({
        state: { error: null, status: "success" },
      })
    ).toBe(false);
  });
  it("기존 캐시가 있어도 선택을 다시 검증하기 전에는 내용을 보고하지 않습니다", async () => {
    const unavailable = vi.fn().mockResolvedValue(undefined);
    refetchNote.mockRejectedValue(
      new ApiError(403, { code: "FORBIDDEN", message: "denied" }, null)
    );
    setMeetingSelection({ noteId: "n1", workspaceId: "w1", requestId: 2 });
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
      meetingTimelineVersion: 2,
      reportMeetingTimeline: report,
      reportMeetingUnavailable: unavailable,
    };
    render(<DesktopMeetingTimelineReporter />);
    expect(report).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(unavailable).toHaveBeenCalledWith("n1", 2, false)
    );
    expect(report).not.toHaveBeenCalled();
  });
  it("선택한 회의는 녹음이 일시정지되어도 보고하고 null로 지우지 않습니다", async () => {
    setMeetingSelection({ noteId: "n1", workspaceId: "w1", requestId: 3 });
    recording.value = { activeNoteId: "n1", phase: "recording" };
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
      meetingTimelineVersion: 2,
      reportMeetingTimeline: report,
    };
    const screen = render(<DesktopMeetingTimelineReporter />);
    await waitFor(() => expect(report).toHaveBeenCalled());
    report.mockClear();
    recording.value = { activeNoteId: null, phase: "completed" };
    note.meetingStatus = "PAUSED";
    screen.rerender(<DesktopMeetingTimelineReporter />);
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: "n1",
          detail: expect.objectContaining({
            selectionId: 3,
            meetingState: "PAUSED",
          }),
        })
      )
    );
    expect(report.mock.calls.some(([value]) => value === null)).toBe(false);
  });
});
