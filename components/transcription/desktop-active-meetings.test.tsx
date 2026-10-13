import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopActiveMeetings } from "./desktop-active-meetings";

const push = vi.fn();
const notes = vi.hoisted(() => ({
  value: [] as Array<Record<string, unknown>>,
  placeholder: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ workspaceId: "w1" }),
}));
vi.mock("@/lib/workspace/use-note-list-pages", () => ({
  useNoteListPages: () => ({
    isPlaceholderData: notes.placeholder,
    dataUpdatedAt: 1,
    data: { status: 200, data: { success: true, data: { notes: notes.value } } },
  }),
}));

const report = vi.fn().mockResolvedValue(undefined);
let open: ((target: { workspaceId: string; noteId: string }) => void) | null = null;

beforeEach(() => {
  report.mockClear();
  push.mockClear();
  open = null;
  notes.placeholder = false;
  notes.value = [
    { noteId: "a", title: "진행", meetingStatus: "IN_PROGRESS", activeSessionStartedAt: "2026-10-13T03:00:00Z" },
    { noteId: "b", title: "끝남", meetingStatus: "ENDED", activeSessionStartedAt: null },
    { noteId: "c", title: "일시정지", meetingStatus: "PAUSED", activeSessionStartedAt: null },
  ];
  (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
    reportActiveMeetings: report,
    subscribeOpenNote: (listener: typeof open) => {
      open = listener;
      return () => undefined;
    },
  };
});
afterEach(() => {
  delete (window as unknown as { heymoaDesktop?: unknown }).heymoaDesktop;
});

describe("DesktopActiveMeetings", () => {
  it("진행 중인 회의만 id와 제목, 시작 시각으로 보고한다", () => {
    render(<DesktopActiveMeetings />);
    expect(report).toHaveBeenCalledWith([
      { workspaceId: "w1", noteId: "a", title: "진행", startedAt: Date.parse("2026-10-13T03:00:00Z") },
    ]);
  });

  it("워크스페이스를 옮기는 동안 남은 이전 목록은 보고하지 않는다", () => {
    notes.placeholder = true;
    render(<DesktopActiveMeetings />);
    expect(report).not.toHaveBeenCalled();
  });

  it("팝오버에서 고른 회의는 그 노트의 전사 화면으로 연다", () => {
    render(<DesktopActiveMeetings />);
    open?.({ workspaceId: "w1", noteId: "a" });
    expect(push).toHaveBeenCalledWith("/w/w1/notes/a?view=full&tab=transcript");
  });

  it("옛 앱(메서드 없음)에서는 아무것도 하지 않는다", () => {
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {};
    render(<DesktopActiveMeetings />);
    expect(report).not.toHaveBeenCalled();
  });
});
