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
// 창은 셸이 소유한다 — 상단바는 「새 노트」를 셸에 **요청**만 한다. 프로젝트가 없을 때
// 프로젝트 창을 먼저 여는 것은 셸의 일이고 `workspace-app-shell.test.tsx`가 본다.
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
// 삭제 다이얼로그도 자체 테스트가 있다 — 여기선 메뉴가 툴바에 걸리는지만 본다.
vi.mock("@/components/notes/note-delete-dialog", () => ({
  NoteDeleteDialog: () => null,
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
    requestNewMeeting.mockReset();
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
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="모든 노트"
        />
      </SidebarProvider>
    );

    const newNote = screen.getByRole("button", { name: "새 노트" });
    // **프로젝트가 없어도 눌린다.** 예전에는 대상 프로젝트가 없으면 비활성이라, 새
    // 워크스페이스에 처음 들어온 사람이 가장 먼저 보는 것이 죽은 버튼이었다.
    expect(newNote).not.toBeDisabled();
    fireEvent.click(newNote);
    expect(requestNewMeeting).toHaveBeenCalledOnce();
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    // 노트가 열려 있지 않으면 회의 조작 슬롯은 없다.
    expect(screen.queryByTestId("meeting-controls")).toBeNull();
  });

  // 상단바는 더 이상 노트를 모른다 — 노트 전체 화면이 이 바를 통째로 덮고 자기 크롬을
  // 직접 그린다(design.pen `XtEMZ`). 회의 제어·닫기·노트 메뉴가 실제로 그려지는지는
  // `note-panel.test.tsx`의 「full 모드는 요약 탭과 함께 회의 제어·창 제어를 직접 갖는다」가 본다.
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
    // 허브 크롬은 그대로다.
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

    // 다른 노트가 기록 중이어도 진입점은 하나다.
    expect(screen.getAllByRole("button", { name: "새 노트" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));
    expect(requestNewMeeting).toHaveBeenCalledOnce();
  });

  it("덮이면 바 전체가 inert가 된다", () => {
    // 창을 닫는 것은 이제 셸의 일이다(`workspace-app-shell.test.tsx`) — 창을 소유한 쪽이
    // 닫아야 한다. 여기 남는 것은 바 자신이 포커스에서 빠지는지다.
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
    expect(screen.getByRole("button", { name: "녹음 종료" })).toBeDisabled();
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

      const stop = screen.getByRole("button", { name: "녹음 종료" });
      fireEvent.click(stop);
      expect(stop).toBeDisabled();
      expect(recording.stop).not.toHaveBeenCalled();
    }
  );
});
