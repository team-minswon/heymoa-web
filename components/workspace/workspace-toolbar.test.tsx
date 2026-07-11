import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { SidebarProvider } from "@/components/ui/sidebar";

const recording = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  elapsedMs: 0,
  error: null,
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
}));
vi.mock("@/lib/api/generated/note/note", () => ({
  useCreateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("WorkspaceToolbar", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("shows the start action when idle", () => {
    recording.session = null;
    recording.elapsedMs = 0;
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="모든 노트"
          language="ko"
          onLanguageChange={vi.fn()}
        />
      </SidebarProvider>
    );

    expect(
      screen.getByRole("button", { name: "실시간 기록 시작" })
    ).toBeEnabled();
  });

  it("shows global pause and stop controls while streaming", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "STREAMING",
    };
    recording.elapsedMs = 12_000;
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="주간"
          language="ko"
          onLanguageChange={vi.fn()}
        />
      </SidebarProvider>
    );

    expect(screen.getByText("Recording")).toBeInTheDocument();
    expect(screen.getByText("00:12")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "녹음 일시 정지" })
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "녹음 종료" })).toBeEnabled();
  });
});
