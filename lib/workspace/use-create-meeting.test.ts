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
          title: "실시간 기록 노트",
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
      await result.current.createMeeting();
    });

    expect(recording.start).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/meetings/01K0000000100?view=full&tab=transcript"
    );
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

  // 변이 감사에서 나온 구멍: 캐시 갱신의 `!==` 를 `===` 로 뒤집어도 아무 테스트가 안 잡았다.
  // 기존 캐시가 비어 있는 경우만 검증하고 있었기 때문이다. 뒤집히면 새 회의만 남고
  // 목록의 나머지가 전부 사라진다.
  it("기존 목록을 지우지 않고 맨 앞에 붙인다", async () => {
    createNote.mockResolvedValue({
      status: 201,
      headers: new Headers(),
      data: {
        success: true,
        data: {
          noteId: "01K0000000100",
          projectId: "01K0000000001",
          title: "새 회의",
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
    client.setQueryData(["/v1/projects/01K0000000001/notes"], {
      status: 200,
      headers: new Headers(),
      data: {
        success: true,
        error: null,
        data: {
          notes: [
            { noteId: "01K0000000009", title: "이미 있던 회의" },
            // 같은 id 가 이미 있으면 새 것으로 갈아끼워야 한다 — 두 벌이 되면 안 된다.
            { noteId: "01K0000000100", title: "낡은 사본" },
          ],
        },
      },
    });
    const { result } = renderHook(() => useCreateMeeting("01K0000000000"), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.createMeeting();
    });

    const cached = client.getQueryData([
      "/v1/projects/01K0000000001/notes",
    ]) as { data: { data: { notes: { noteId: string; title: string }[] } } };
    expect(cached.data.data.notes.map((note) => note.noteId)).toEqual([
      "01K0000000100",
      "01K0000000009",
    ]);
    expect(cached.data.data.notes[0].title).toBe("새 회의");
  });
});
