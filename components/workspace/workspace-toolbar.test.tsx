import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { SidebarProvider } from "@/components/ui/sidebar";

const recording = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  activeNoteId: undefined as string | undefined,
  activeWorkspaceId: undefined as string | undefined,
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
const requestNewMeeting = vi.hoisted(() => vi.fn());
const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
  useRecordingMeter: () => recordingMeter,
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => ({ requestNewMeeting }),
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNote: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: "01K0000000002",
          projectId: "01K0000000001",
          title: "주간 제품 회의",
          meetingStatus: "ENDED",
        },
      },
    },
  }),
}));
vi.mock("@/components/notes/note-delete-dialog", () => ({
  NoteDeleteDialog: () => null,
}));
vi.mock("@/components/notes/meeting-controls", () => ({
  MeetingControls: () => <div data-testid="meeting-controls" />,
}));

describe("WorkspaceToolbar", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
    replace.mockReset();
    requestNewMeeting.mockReset();
    recording.start.mockReset();
    recording.stop.mockReset();
    recording.activeNoteId = undefined;
    recording.activeWorkspaceId = undefined;
    nav.search = "";
  });
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("carries the single-row app bar: new note, no bell, no note actions on the hub", () => {
    recording.session = null;
    recording.phase = "idle";
    recording.elapsedMs = 0;
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="모든 노트"
        />
      </SidebarProvider>
    );

    const newNote = screen.getByRole("button", { name: "새 노트" });
    expect(newNote).not.toBeDisabled();
    fireEvent.click(newNote);
    expect(requestNewMeeting).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /알림/ })).toBeNull();
    expect(screen.queryByTestId("meeting-controls")).toBeNull();
  });

  it("노트가 열려 있어도 상단바는 허브 크롬만 그린다", () => {
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

    expect(screen.queryByTestId("meeting-controls")).toBeNull();
    expect(screen.queryByRole("button", { name: "노트 닫기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "노트 메뉴" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "주간 제품 회의" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "새 노트" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /알림/ })).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: "녹음 일시정지" }));
    expect(recording.stop).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: /일시 정지|재개/ })
    ).not.toBeInTheDocument();
  });

  it("다른 워크스페이스의 녹음으로 돌아갈 때 그 워크스페이스로 간다", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    };
    recording.activeNoteId = "01K0000000002";
    recording.activeWorkspaceId = "01K0000000006";
    recording.phase = "recording";

    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="주간"
          activeNoteId="01K0000000099"
        />
      </SidebarProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "현재 녹음" }));

    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000006/notes/01K0000000002?view=side&tab=details"
    );
  });

  it("keeps one 새 노트 entry while another note is recording", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    };
    recording.activeNoteId = "01K0000000002";
    recording.phase = "recording";

    render(
      <SidebarProvider>
        <WorkspaceToolbar workspaceId="01K0000000000" currentLabel="주간" />
      </SidebarProvider>
    );

    expect(screen.getAllByRole("button", { name: "새 노트" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));
    expect(requestNewMeeting).toHaveBeenCalledOnce();
  });

  it("덮이면 바 전체가 inert가 된다", () => {
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="주간"
          covered
        />
      </SidebarProvider>
    );

    expect(
      screen.getByRole("button", { name: "새 노트" }).closest("[inert]")
    ).not.toBeNull();
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
    expect(screen.getByRole("button", { name: "녹음 일시정지" })).toBeDisabled();
  });

  it.each(["requesting-permission", "connecting"] as const)(
    "does not expose stop while recording startup is %s",
    (phase) => {
      recording.session = {
        sessionId: "01K0000000010",
        noteId: "01K0000000002",
        status: "READY",
      };
      recording.activeNoteId = "01K0000000002";
      recording.phase = phase;

      render(
        <SidebarProvider>
          <WorkspaceToolbar workspaceId="01K0000000000" currentLabel="주간" />
        </SidebarProvider>
      );

      const stop = screen.getByRole("button", { name: "녹음 일시정지" });
      fireEvent.click(stop);
      expect(stop).toBeDisabled();
      expect(recording.stop).not.toHaveBeenCalled();
    }
  );
});
