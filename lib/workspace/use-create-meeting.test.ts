import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateMeeting } from "@/lib/workspace/use-create-meeting";

const push = vi.hoisted(() => vi.fn());
const getUserMedia = vi.hoisted(() => vi.fn());
const createNote = vi.hoisted(() => vi.fn());
const recording = vi.hoisted(() => ({
  phase: "idle" as string,
  activeNoteId: undefined as string | undefined,
  session: null as null | { noteId: string },
  start: vi.fn(),
}));
const shell = vi.hoisted(() => ({
  selectedProjectId: "01K0000000001" as string | null,
  projects: [{ projectId: "01K0000000001", name: "모바일 앱" }] as {
    projectId: string;
    name: string;
  }[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => shell,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNotesQueryKey: (projectId: string) => [
    `/v1/projects/${projectId}/notes`,
  ],
  useCreateNote: () => ({ mutateAsync: createNote, isPending: false }),
}));

function wrapper(client: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return QueryWrapper;
}

describe("useCreateMeeting", () => {
  beforeEach(() => {
    push.mockReset();
    createNote.mockReset();
    recording.start.mockReset();
    getUserMedia.mockReset();
    getUserMedia.mockResolvedValue({} as MediaStream);
    recording.start.mockImplementation(async () => {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    recording.phase = "idle";
    recording.activeNoteId = undefined;
    recording.session = null;
    shell.selectedProjectId = "01K0000000001";
  });
  afterEach(() => vi.clearAllMocks());

  it("creates a NOT_STARTED note and opens the full view without requesting the microphone", async () => {
    recording.phase = "recording";
    recording.activeNoteId = "01K0000000002";
    createNote.mockResolvedValue({
      status: 201,
      headers: new Headers(),
      data: {
        success: true,
        data: {
          noteId: "01K0000000100",
          projectId: "01K0000000001",
          title: "주간 제품 회의",
          createdAt: "2026-07-19T10:00:00Z",
          updatedAt: "2026-07-19T10:00:00Z",
          meetingStatus: "NOT_STARTED",
          meetingStartedBy: null,
          meetingStartedAt: null,
          activeSessionStartedAt: null,
          recordedDurationMs: 0,
        },
      },
    });
    const client = new QueryClient();
    const { result } = renderHook(() => useCreateMeeting("01K0000000000"), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.createMeeting("주간 제품 회의");
    });

    expect(recording.start).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    // tab을 안 붙인다 — 전사가 기본 탭이고, 붙이면 "기록하러 왔다"로 읽힌다.
    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/notes/01K0000000100?view=full"
    );
    expect(createNote).toHaveBeenCalledWith({
      projectId: "01K0000000001",
      data: { title: "주간 제품 회의" },
    });
    expect(
      client.getQueryData(["/v1/projects/01K0000000001/notes"])
    ).toMatchObject({
      status: 200,
      data: {
        success: true,
        data: {
          notes: [
            {
              noteId: "01K0000000100",
              meetingStatus: "NOT_STARTED",
              lastRecordedAt: null,
              recordedDurationMs: 0,
            },
          ],
        },
      },
    });
  });
});
