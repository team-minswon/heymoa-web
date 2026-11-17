import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceRouteLayout } from "@/components/workspace/workspace-route-layout";
import {
  getGetWorkspaceQueryKey,
  getGetWorkspacesQueryKey,
} from "@/lib/api/generated/workspaces/workspaces";
import { makeQueryClient } from "@/lib/query/query-client";

const WORKSPACE_ID = "01K90000000000";
const OTHER_WORKSPACE_ID = "01K91111111111";

const GONE = {
  success: false,
  data: null,
  error: {
    code: "WORKSPACE_NOT_FOUND",
    message: "워크스페이스를 찾을 수 없습니다.",
  },
} as const;

const route = vi.hoisted(() => ({
  noteId: undefined as string | undefined,
  pathname: "/w/01K90000000000",
  search: "",
  replaceMock: vi.fn(),
  shellError: null as unknown,
  workspaceFetch: null as (() => Promise<unknown>) | null,
  recording: null as {
    activeWorkspaceId: string | null;
    phase: string;
    session: unknown;
  } | null,
  disconnectMock: vi.fn(async () => {}),
  toastMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ noteId: route.noteId }),
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.search),
  useRouter: () => ({ replace: route.replaceMock }),
}));

vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    ...actual,
    useRecording: () => ({
      activeWorkspaceId: route.recording?.activeWorkspaceId ?? null,
      phase: route.recording?.phase ?? "idle",
      session: route.recording?.session ?? null,
      disconnect: route.disconnectMock,
    }),
  };
});

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ logout: route.logoutMock }),
}));
vi.mock("@/lib/ui/toast", () => ({
  toast: { error: route.toastMock, success: vi.fn(), dismiss: vi.fn() },
}));

function recordingIn(workspaceId: string) {
  return {
    activeWorkspaceId: workspaceId,
    phase: "recording",
    session: null,
  };
}

vi.mock("@/lib/api/fetcher", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/fetcher")>(
      "@/lib/api/fetcher"
    );
  return {
    ...actual,
    apiFetch: (url: string) =>
      route.workspaceFetch
        ? route.workspaceFetch()
        : Promise.reject(new Error(`목이 없는 호출: ${url}`)),
  };
});

vi.mock("@/components/workspace/workspace-app-shell", () => ({
  WorkspaceAppShell: ({
    activeNoteId,
    children,
  }: {
    activeNoteId?: string;
    children: React.ReactNode;
  }) => {
    if (route.shellError) throw route.shellError;
    return (
      <div data-testid="workspace-shell" data-active-note-id={activeNoteId}>
        {children}
      </div>
    );
  },
}));

vi.mock("@/components/workspace/workspace-page", () => ({
  WorkspacePage: () => <div>워크스페이스 목록</div>,
}));

function alwaysGone() {
  return () => Promise.reject(GONE);
}

function renderLayout(
  client: QueryClient,
  children: React.ReactNode = <div />
) {
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceRouteLayout workspaceId={WORKSPACE_ID}>
        {children}
      </WorkspaceRouteLayout>
    </QueryClientProvider>
  );
}

function stateOf(client: QueryClient) {
  return client
    .getQueryCache()
    .find({ queryKey: getGetWorkspaceQueryKey(WORKSPACE_ID) })?.state;
}

function resetRoute() {
  route.noteId = undefined;
  route.pathname = `/w/${WORKSPACE_ID}`;
  route.search = "";
  route.replaceMock.mockReset();
  route.shellError = null;
  route.workspaceFetch = () => new Promise(() => {});
  route.recording = null;
  route.disconnectMock.mockReset();
  route.toastMock.mockReset();
  route.logoutMock.mockReset();
}

describe("WorkspaceRouteLayout", () => {
  afterEach(cleanup);
  beforeEach(resetRoute);

  it("keeps the workspace page mounted behind a side note", () => {
    route.noteId = "note-1";
    route.search = "view=side&tab=transcript";

    renderLayout(makeQueryClient(), <div>노트 패널</div>);

    expect(screen.getByText("워크스페이스 목록")).toBeInTheDocument();
    expect(screen.getByText("노트 패널")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-active-note-id",
      "note-1"
    );
  });

  it("할 일 화면에서는 노트 목록을 마운트하지 않는다", () => {
    route.pathname = `/w/${WORKSPACE_ID}/tasks`;

    renderLayout(makeQueryClient(), <div>할 일 화면</div>);

    expect(screen.queryByText("워크스페이스 목록")).not.toBeInTheDocument();
    expect(screen.getByText("할 일 화면")).toBeInTheDocument();
  });

  it("keeps the workspace page mounted for a full-screen note (sidebar retained)", () => {
    route.noteId = "note-1";
    route.search = "view=full&tab=transcript";

    renderLayout(makeQueryClient(), <div>전체 화면 노트</div>);

    expect(screen.getByText("워크스페이스 목록")).toBeInTheDocument();
    expect(screen.getByText("전체 화면 노트")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-active-note-id",
      "note-1"
    );
  });
});

describe("추방당했을 때", () => {
  beforeEach(() => {
    resetRoute();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("재시도가 남아 있어도 첫 실패에 내보낸다", async () => {
    const client = makeQueryClient();
    let attempts = 0;
    route.workspaceFetch = () => {
      attempts += 1;
      return Promise.reject(GONE);
    };

    renderLayout(client);

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    expect(attempts).toBe(1);
  });

  it("보고 있는 중에 추방되면 다음 확인에서 내보낸다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeQueryClient();
    route.workspaceFetch = () =>
      Promise.resolve({
        status: 200,
        data: { success: true, data: { workspaceId: WORKSPACE_ID } },
      });

    renderLayout(client);
    await waitFor(() => expect(stateOf(client)?.status).toBe("success"));
    expect(route.replaceMock).not.toHaveBeenCalled();

    route.workspaceFetch = alwaysGone();
    await vi.advanceTimersByTimeAsync(30_000);

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    vi.useRealTimers();
  });

  it("이동 전에 죽은 워크스페이스를 목록 캐시에서 뺀다", async () => {
    const client = makeQueryClient();
    client.setQueryData(getGetWorkspacesQueryKey(), {
      status: 200,
      data: {
        success: true,
        data: {
          workspaces: [
            { workspaceId: WORKSPACE_ID },
            { workspaceId: OTHER_WORKSPACE_ID },
          ],
        },
      },
    });
    route.workspaceFetch = alwaysGone();

    renderLayout(client);

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    const list = client.getQueryData(getGetWorkspacesQueryKey()) as {
      data: { data: { workspaces: { workspaceId: string }[] } };
    };
    expect(list.data.data.workspaces).toEqual([
      { workspaceId: OTHER_WORKSPACE_ID },
    ]);
  });

  it("첫 진입 404는 재시도를 그리지 않는다", () => {
    route.shellError = GONE;

    renderLayout(makeQueryClient());

    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });

  it("다른 실패는 재시도를 그대로 그리고 이동하지 않는다", async () => {
    route.shellError = new Error("Network request failed");
    route.workspaceFetch = () =>
      Promise.reject(new Error("Network request failed"));

    renderLayout(makeQueryClient());

    expect(
      await screen.findByRole("button", { name: "다시 시도" })
    ).toBeInTheDocument();
    expect(route.replaceMock).not.toHaveBeenCalled();
  });
});

describe("추방당했을 때 녹음", () => {
  beforeEach(() => {
    resetRoute();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("이 워크스페이스를 녹음 중이면 정리한다", async () => {
    route.workspaceFetch = alwaysGone();
    route.recording = recordingIn(WORKSPACE_ID);

    renderLayout(makeQueryClient());

    await waitFor(() => expect(route.disconnectMock).toHaveBeenCalled());
  });

  it("다른 워크스페이스를 녹음 중이면 건드리지 않는다", async () => {
    route.workspaceFetch = alwaysGone();
    route.recording = recordingIn(OTHER_WORKSPACE_ID);

    renderLayout(makeQueryClient());

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    expect(route.disconnectMock).not.toHaveBeenCalled();
  });
});

describe("강제로 나가질 때 안내", () => {
  beforeEach(() => {
    resetRoute();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("보고 있던 곳에서 쫓겨나면 왜 나갔는지 알려준다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeQueryClient();
    route.workspaceFetch = () =>
      Promise.resolve({
        status: 200,
        data: { success: true, data: { workspaceId: WORKSPACE_ID } },
      });
    renderLayout(client);
    await waitFor(() => expect(stateOf(client)?.status).toBe("success"));

    route.workspaceFetch = alwaysGone();
    await vi.advanceTimersByTimeAsync(30_000);

    await waitFor(() =>
      expect(route.toastMock).toHaveBeenCalledWith(
        "이 워크스페이스에 더 이상 접근할 수 없습니다.",
        expect.objectContaining({ id: expect.any(String) })
      )
    );
    vi.useRealTimers();
  });

  it("내가 나가는 중이면 안 띄운다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeQueryClient();
    route.workspaceFetch = () =>
      Promise.resolve({
        status: 200,
        data: { success: true, data: { workspaceId: WORKSPACE_ID } },
      });
    renderLayout(client);
    await waitFor(() => expect(stateOf(client)?.status).toBe("success"));

    void client
      .getMutationCache()
      .build(client, {
        mutationKey: ["leaveWorkspace"],
        mutationFn: () => new Promise<void>(() => {}),
      })
      .execute({ workspaceId: WORKSPACE_ID });

    route.workspaceFetch = alwaysGone();
    await vi.advanceTimersByTimeAsync(30_000);

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    expect(route.toastMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("한 번도 들어가 본 적 없는 곳이면 열 수 없다고 말하고 계정을 바꿀 길을 둔다", async () => {
    route.workspaceFetch = alwaysGone();

    renderLayout(makeQueryClient());

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    expect(route.toastMock).toHaveBeenCalledTimes(1);
    const [message, options] = route.toastMock.mock.calls[0];
    expect(message).toBe("이 워크스페이스의 회의를 열 수 없습니다.");
    expect(message).not.toContain("나가게");
    options.action.onClick();
    expect(route.logoutMock).toHaveBeenCalled();
  });
});
