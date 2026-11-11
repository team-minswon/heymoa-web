import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopActiveMeetings } from "./desktop-active-meetings";
import { ApiError } from "@/lib/api/fetcher";

const push = vi.fn();
const queryState = vi.hoisted(() => ({
  isError: false,
  error: null as Error | null,
}));
const notes = vi.hoisted(() => ({
  value: [] as Array<Record<string, unknown>>,
  placeholder: false,
  workspaceId: "w1" as string | undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ workspaceId: notes.workspaceId }),
}));
const listOptions = vi.hoisted(() => ({
  value: null as null | {
    refetchInterval: (notes: undefined) => number;
    refetchIntervalInBackground?: boolean;
  },
}));
// 이벤트 스트림이 건강해도 데스크톱 보고 간격은 그대로다(PRO-67 I04) — 앱이 150초 안에 보고가 없으면 트레이를 비운다.
vi.mock("@/lib/events/health", () => ({ useEventStreamHealthy: () => true }));
vi.mock("@/lib/workspace/use-note-list-pages", () => ({
  useNoteListPages: (options: typeof listOptions.value) => {
    listOptions.value = options;
    return {
      ...queryState,
      isPlaceholderData: notes.placeholder,
      dataUpdatedAt: 1,
      data: {
        status: 200,
        data: { success: true, data: { notes: notes.value } },
      },
    };
  },
}));

const report = vi.fn().mockResolvedValue(undefined);
let open:
  | ((target: {
      workspaceId: string;
      noteId: string;
      tab?: "summary" | "transcript";
    }) => void)
  | null = null;

beforeEach(() => {
  report.mockClear();
  push.mockClear();
  open = null;
  notes.placeholder = false;
  notes.workspaceId = "w1";
  queryState.isError = false;
  queryState.error = null;
  notes.value = [
    {
      noteId: "a",
      title: "진행",
      meetingStatus: "IN_PROGRESS",
      recordedDurationMs: 600_000,
      activeSessionStartedAt: "2026-10-13T03:00:00Z",
    },
    {
      noteId: "b",
      title: "끝남",
      meetingStatus: "ENDED",
      activeSessionStartedAt: null,
    },
    {
      noteId: "c",
      title: "일시정지",
      meetingStatus: "PAUSED",
      activeSessionStartedAt: null,
    },
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
  cleanup();
  delete (window as unknown as { heymoaDesktop?: unknown }).heymoaDesktop;
});

describe("DesktopActiveMeetings", () => {
  it("이벤트 스트림과 무관하게 30초마다, 창이 숨어도 보고한다", () => {
    render(<DesktopActiveMeetings />);
    expect(listOptions.value?.refetchInterval(undefined)).toBe(30_000);
    expect(listOptions.value?.refetchIntervalInBackground).toBe(true);
  });

  it("진행 중인 회의만 id와 제목, 녹음 시계 원점으로 보고한다 — 재개한 회의는 앞 구간만큼 이르다", () => {
    render(<DesktopActiveMeetings />);
    expect(report).toHaveBeenCalledWith([
      {
        workspaceId: "w1",
        noteId: "a",
        title: "진행",
        startedAt: Date.parse("2026-10-13T03:00:00Z") - 600_000,
      },
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

describe("작은 앱의 회의 목록", () => {
  it("일시적인 목록 갱신 실패는 기존 목록을 유지하고 접근 거부는 비웁니다", () => {
    const list = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
      meetingTimelineVersion: 2,
      reportActiveMeetings: report,
      reportMeetingList: list,
    };
    const screen = render(<DesktopActiveMeetings />);
    queryState.isError = true;
    queryState.error = new ApiError(
      500,
      { code: "ERROR", message: "temporary" },
      null
    );
    screen.rerender(<DesktopActiveMeetings />);
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "failed",
        meetings: expect.arrayContaining([
          expect.objectContaining({ noteId: "a" }),
        ]),
      })
    );
    queryState.error = new ApiError(
      403,
      { code: "FORBIDDEN", message: "denied" },
      null
    );
    screen.rerender(<DesktopActiveMeetings />);
    expect(list).toHaveBeenLastCalledWith({
      workspaceId: "w1",
      status: "failed",
      meetings: [],
    });
  });
  it("v2에는 일시정지와 지난 회의도 상태와 함께 보내고 선택만으로 메인 화면을 이동하지 않습니다", () => {
    const list = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
      meetingTimelineVersion: 2,
      reportActiveMeetings: report,
      reportMeetingList: list,
    };
    render(<DesktopActiveMeetings />);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        status: "ready",
        meetings: [
          expect.objectContaining({ noteId: "a", state: "IN_PROGRESS" }),
          expect.objectContaining({ noteId: "b", state: "ENDED" }),
          expect.objectContaining({ noteId: "c", state: "PAUSED" }),
        ],
      })
    );
    expect(report).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
  it("워크스페이스가 바뀌어 아직 이전 목록만 있으면 새 범위의 로딩을 알립니다", () => {
    const list = vi.fn().mockResolvedValue(undefined);
    notes.placeholder = true;
    (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
      meetingTimelineVersion: 2,
      reportActiveMeetings: report,
      reportMeetingList: list,
    };
    render(<DesktopActiveMeetings />);
    expect(list).toHaveBeenCalledWith({
      workspaceId: "w1",
      status: "loading",
      meetings: [],
    });
  });
});

it("워크스페이스 밖에서 시작하면 선택 안내를 하고 이후 설정 화면에서도 마지막 범위를 유지합니다", () => {
  const list = vi.fn().mockResolvedValue(undefined);
  notes.workspaceId = undefined;
  (window as unknown as { heymoaDesktop: unknown }).heymoaDesktop = {
    meetingTimelineVersion: 2,
    reportActiveMeetings: report,
    reportMeetingList: list,
  };
  const screen = render(<DesktopActiveMeetings />);
  expect(list).toHaveBeenLastCalledWith({
    workspaceId: null,
    status: "no-workspace",
    meetings: [],
  });
  notes.workspaceId = "w1";
  screen.rerender(<DesktopActiveMeetings />);
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ workspaceId: "w1", status: "ready" })
  );
  notes.workspaceId = undefined;
  screen.rerender(<DesktopActiveMeetings />);
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ workspaceId: "w1", status: "ready" })
  );
});
it("전체 앱으로 열면 팝업에서 선택한 탭을 유지합니다", () => {
  render(<DesktopActiveMeetings />);
  open?.({ workspaceId: "w1", noteId: "b", tab: "summary" });
  expect(push).toHaveBeenCalledWith("/w/w1/notes/b?view=full&tab=summary");
});
