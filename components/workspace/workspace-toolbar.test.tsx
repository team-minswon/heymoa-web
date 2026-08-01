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
const chat = vi.hoisted(() => ({
  isVisible: false,
  open: vi.fn(),
  close: vi.fn(),
}));
const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
  useRecordingMeter: () => recordingMeter,
}));
vi.mock("@/components/chat/personal-chat", () => ({
  usePersonalChat: () => chat,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNote: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: { noteId: "01K0000000002", title: "주간 제품 회의" },
      },
    },
  }),
}));

const renderToolbar = (props: Parameters<typeof WorkspaceToolbar>[0]) =>
  render(
    <SidebarProvider>
      <WorkspaceToolbar {...props} />
    </SidebarProvider>
  );

describe("WorkspaceToolbar", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
    replace.mockReset();
    chat.open.mockReset();
    chat.close.mockReset();
    chat.isVisible = false;
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

  it("carries only the location label and the agent entry on the hub", () => {
    recording.session = null;
    recording.phase = "idle";
    recording.elapsedMs = 0;
    renderToolbar({ workspaceId: "01K0000000000", currentLabel: "모든 회의" });

    expect(screen.getByText("모든 회의")).toBeInTheDocument();
    // 「새 회의」는 페이지 머리가 갖는다 — 상단바에 두면 같은 버튼이 두 번 나온다.
    expect(screen.queryByRole("button", { name: "새 회의" })).toBeNull();
    // 노트가 열려 있지 않으면 회의 조작 슬롯은 없다.
    expect(screen.queryByTestId("meeting-controls")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "에이전트" }));
    expect(chat.open).toHaveBeenCalledOnce();
  });

  it("closes the agent rail when it is already open", () => {
    recording.session = null;
    recording.phase = "idle";
    chat.isVisible = true;
    renderToolbar({ workspaceId: "01K0000000000", currentLabel: "모든 회의" });

    fireEvent.click(screen.getByRole("button", { name: "에이전트" }));
    expect(chat.close).toHaveBeenCalledOnce();
    expect(chat.open).not.toHaveBeenCalled();
  });

  it("swaps the label for the note title in a full note but keeps note actions out", () => {
    recording.session = null;
    recording.phase = "idle";
    nav.search = "view=full&tab=transcript";
    renderToolbar({
      workspaceId: "01K0000000000",
      currentLabel: "모든 회의",
      activeNoteId: "01K0000000002",
    });

    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    // 회의 조작·닫기는 회의 화면이 자기 상단바에서 든다 — 셸 상단바는 위치만 말한다.
    expect(screen.queryByTestId("meeting-controls")).toBeNull();
    expect(screen.queryByRole("button", { name: "회의 닫기" })).toBeNull();
  });

  it("shows the recording pill with a meter and a stop control while off the note", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    };
    recording.activeNoteId = "01K0000000002";
    recording.phase = "recording";
    recording.elapsedMs = 12_000;
    renderToolbar({ workspaceId: "01K0000000000", currentLabel: "주간" });

    expect(screen.getByRole("meter", { name: "마이크 입력" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(screen.getByText("00:12")).toBeInTheDocument();
    // 필은 회의로 돌아가는 길을 함께 낸다 — 정지만 있으면 되돌아갈 곳이 없다.
    fireEvent.click(screen.getByRole("button", { name: "회의로" }));
    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/meetings/01K0000000002?view=full&tab=transcript"
    );

    fireEvent.click(screen.getByRole("button", { name: "녹음 종료" }));
    expect(recording.stop).toHaveBeenCalledOnce();
  });

  it("hides the pill while the note it records is the one on screen", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    };
    recording.activeNoteId = "01K0000000002";
    recording.phase = "recording";
    nav.search = "view=full&tab=transcript";
    renderToolbar({
      workspaceId: "01K0000000000",
      currentLabel: "주간",
      activeNoteId: "01K0000000002",
    });

    expect(screen.queryByRole("meter", { name: "마이크 입력" })).toBeNull();
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
    renderToolbar({ workspaceId: "01K0000000000", currentLabel: "주간" });

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
      renderToolbar({ workspaceId: "01K0000000000", currentLabel: "주간" });

      const stop = screen.getByRole("button", { name: "녹음 종료" });
      fireEvent.click(stop);
      expect(stop).toBeDisabled();
      expect(recording.stop).not.toHaveBeenCalled();
    }
  );
});
