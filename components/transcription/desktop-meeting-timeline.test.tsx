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
