import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopMeetingTimelineReporter } from "./desktop-meeting-timeline";

const recording = vi.hoisted(() => ({
  value: { activeNoteId: null as string | null, phase: "idle" },
}));
const note = vi.hoisted(() => ({ meetingStatus: "ACTIVE" }));

vi.mock("./recording-provider", () => ({ useRecording: () => recording.value }));
vi.mock("@/components/notes/note-realtime-provider", () => ({
  NoteRealtimeProvider: ({ children }: { children: React.ReactNode }) => children,
  useNoteRealtime: () => ({
    noteId: "n1",
    context: { state: { items: [] }, loading: false, failed: false },
    reconnecting: false,
    subscriptionIssue: null,
  }),
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNote: () => ({
    isError: false,
    data: { status: 200, data: { success: true, data: { title: "뷰어 회의", ...note } } },
  }),
}));
vi.mock("@/lib/desktop/meeting-timeline", () => ({
  meetingTimelineSnapshot: (noteId: string, title: string) => ({ noteId, title }),
}));

const report = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  report.mockClear();
  (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = { reportMeetingTimeline: report };
  recording.value = { activeNoteId: null, phase: "idle" };
  note.meetingStatus = "ACTIVE";
});
afterEach(() => {
  delete (window as unknown as { heymoaDesktop?: unknown }).heymoaDesktop;
});

describe("DesktopMeetingTimelineReporter 뷰어", () => {
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
    let open: ((target: { workspaceId: string; noteId: string }) => void) | null = null;
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
