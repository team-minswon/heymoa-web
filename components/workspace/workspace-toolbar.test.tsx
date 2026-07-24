import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { SidebarProvider } from "@/components/ui/sidebar";

const recording = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  activeNoteId: undefined as string | undefined,
  elapsedMs: 0,
  phase: "idle",
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
}));
const recordingMeter = vi.hoisted(() => ({
  level: 0.42,
  levelHistory: [0.1, 0.25, 0.7, 0.4],
}));
const push = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const createMeeting = vi.hoisted(() => vi.fn());
const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
  useRecordingMeter: () => recordingMeter,
}));
vi.mock("@/lib/workspace/use-create-meeting", () => ({
  useCreateMeeting: () => ({
    createMeeting,
    disabled: false,
    isPending: false,
    isRecordingCurrent: false,
  }),
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNote: () => ({
    data: {
      status: 200,
      data: { success: true, data: { noteId: "01K0000000002", title: "주간 제품 회의" } },
    },
  }),
}));
// 회의 조작·벨은 각자 테스트가 있다 — 여기선 툴바에 걸리는지만 본다.
vi.mock("@/components/notes/meeting-controls", () => ({
  MeetingControls: () => <div data-testid="meeting-controls" />,
}));
vi.mock("@/components/notification/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

describe("WorkspaceToolbar", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
    replace.mockReset();
    createMeeting.mockReset();
    recording.start.mockReset();
    recording.stop.mockReset();
    recording.activeNoteId = undefined;
    nav.search = "";
  });
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("carries the single-row app bar: new note + bell, no note actions on the hub", () => {
    recording.session = null;
    recording.phase = "idle";
    recording.elapsedMs = 0;
    render(
      <SidebarProvider>
        <WorkspaceToolbar workspaceId="01K0000000000" currentLabel="모든 노트" />
      </SidebarProvider>
    );

    const newNote = screen.getByRole("button", { name: "새 노트" });
    fireEvent.click(newNote);
    expect(createMeeting).toHaveBeenCalledOnce();
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    // 노트가 열려 있지 않으면 회의 조작 슬롯은 없다.
    expect(screen.queryByTestId("meeting-controls")).toBeNull();
  });

  it("lifts note actions into the same row for a full note", () => {
    recording.session = null;
    recording.phase = "idle";
    nav.search = "view=full&tab=transcript";
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="모든 노트"
          activeNoteId="01K0000000002"
        />
      </SidebarProvider>
    );

    // 브레드크럼에 노트 제목, 같은 행에 회의 조작 + 닫기 + 새 노트 + 벨.
    expect(screen.getByRole("heading", { name: "주간 제품 회의" })).toBeInTheDocument();
    expect(screen.getByTestId("meeting-controls")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "노트 닫기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새 노트" })).toBeInTheDocument();
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("shows automatic recording status with only a stop control", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    };
    recording.activeNoteId = "01K0000000002";
    recording.phase = "recording";
    recording.elapsedMs = 12_000;
    render(
      <SidebarProvider>
        <WorkspaceToolbar workspaceId="01K0000000000" currentLabel="주간" />
      </SidebarProvider>
    );

    expect(screen.queryByText("녹음 중")).toBeNull();
    expect(screen.getByRole("meter", { name: "마이크 입력" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(screen.getByText("00:12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "녹음 종료" }));
    expect(recording.stop).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: /일시 정지|재개/ })
    ).not.toBeInTheDocument();
  });

  it("replaces transitional status labels with the shared spinner", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    };
    recording.activeNoteId = "01K0000000002";
    recording.phase = "stopping";
    recording.elapsedMs = 12_000;

    render(
      <SidebarProvider>
        <WorkspaceToolbar workspaceId="01K0000000000" currentLabel="주간" />
      </SidebarProvider>
    );

    expect(
      screen.getByRole("status", { name: "녹음 처리 중" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("meter", { name: "마이크 입력" })).toBeNull();
    expect(screen.getByRole("button", { name: "녹음 종료" })).toBeDisabled();
  });
});
