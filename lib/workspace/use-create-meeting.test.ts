import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateMeeting } from "@/lib/workspace/use-create-meeting";

const push = vi.hoisted(() => vi.fn());
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

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
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
    recording.phase = "idle";
    recording.activeNoteId = undefined;
    recording.session = null;
    shell.selectedProjectId = "01K0000000001";
  });
  afterEach(() => vi.clearAllMocks());

  it("creates a note, optimistically inserts it, routes, and starts recording", async () => {
    createNote.mockResolvedValue({
      status: 201,
      headers: new Headers(),
      data: {
        success: true,
        data: {
          noteId: "01K0000000100",
          projectId: "01K0000000001",
          title: "실시간 기록 노트",
          createdAt: "2026-07-19T10:00:00Z",
          updatedAt: "2026-07-19T10:00:00Z",
        },
      },
    });
    const client = new QueryClient();
    const { result } = renderHook(() => useCreateMeeting("01K0000000000"), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.createMeeting();
    });

    await waitFor(() =>
      expect(recording.start).toHaveBeenCalledWith("01K0000000100")
    );
    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/notes/01K0000000100?view=side&tab=transcript"
    );
    expect(
      client.getQueryData(["/v1/projects/01K0000000001/notes"])
    ).toMatchObject({
      status: 200,
      data: {
        success: true,
        data: {
          notes: [
            { noteId: "01K0000000100", lastRecordedAt: null, recordedDurationMs: 0 },
          ],
        },
      },
    });
  });

  it("opens the active recording instead of creating another meeting", async () => {
    recording.phase = "recording";
    recording.activeNoteId = "01K0000000002";
    const client = new QueryClient();
    const { result } = renderHook(() => useCreateMeeting("01K0000000000"), {
      wrapper: wrapper(client),
    });

    expect(result.current.isRecordingCurrent).toBe(true);
    await act(async () => {
      await result.current.createMeeting();
    });

    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/notes/01K0000000002?view=side&tab=transcript"
    );
    expect(createNote).not.toHaveBeenCalled();
    expect(recording.start).not.toHaveBeenCalled();
  });

  it("is disabled while a recording is starting with no active note", () => {
    recording.phase = "requesting-permission";
    const client = new QueryClient();
    const { result } = renderHook(() => useCreateMeeting("01K0000000000"), {
      wrapper: wrapper(client),
    });
    expect(result.current.disabled).toBe(true);
  });
});
