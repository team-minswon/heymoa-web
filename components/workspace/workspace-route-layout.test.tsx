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

/** 서버가 비멤버에게 돌려주는 봉투. 존재를 숨기려고 403이 아니라 404다. */
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
  search: "",
  replaceMock: vi.fn(),
  /** 셸이 렌더 중 던질 것. null이면 정상 렌더다. */
  shellError: null as unknown,
  /**
   * 워크스페이스 상세 조회의 응답.
   *
   * **훅과 쿼리는 진짜를 쓰고 전송만 갈아끼운다.** APP-381의 테스트는 `useGetWorkspace`를
   * 통째로 목으로 바꿔 `{ error: 봉투 }`를 즉시 돌려줬고, 그래서 **실제로는 그 상태에
   * 도달하지 못한다**는 사실을 가렸다. 재시도 중(=`failureReason`만 찬) 상태를 지나야 한다.
   */
  workspaceFetch: null as (() => Promise<unknown>) | null,
  /** `useRecording()`이 돌려줄 것 중 이 화면이 보는 부분. */
  recording: null as {
    activeWorkspaceId: string | null;
    phase: string;
    session: unknown;
  } | null,
  disconnectMock: vi.fn(async () => {}),
  toastMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ noteId: route.noteId }),
  useSearchParams: () => new URLSearchParams(route.search),
  useRouter: () => ({ replace: route.replaceMock }),
}));

vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    ...actual,
    // 판정(`isWorkspaceRecordingActive`)은 진짜를 쓴다 — 어느 워크스페이스의 녹음인지
    // 가리는 것이 이 테스트의 주제라 그걸 목으로 바꾸면 아무것도 안 지킨다.
    useRecording: () => ({
      activeWorkspaceId: route.recording?.activeWorkspaceId ?? null,
      phase: route.recording?.phase ?? "idle",
      session: route.recording?.session ?? null,
      disconnect: route.disconnectMock,
    }),
  };
});

// 공용 표면에는 `success`·`error`·`dismiss`뿐이다. 원치 않은 일이 벌어졌고 사용자가
// 알아채야 하므로 `error`를 쓴다 — 한 자리를 위해 `info`를 새로 만들지 않는다.
vi.mock("@/lib/ui/toast", () => ({
  toast: { error: route.toastMock, success: vi.fn(), dismiss: vi.fn() },
}));

/** 그 워크스페이스에서 실제로 녹음이 도는 중인 상태. */
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
    // 셸 안의 suspense 조회가 첫 진입부터 실패한 상황. 경계가 잡는 자리다.
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

/**
 * 404로 실패하고 **재시도 대기에 멈춰 서는** 응답.
 *
 * 전역 정책이 `retry: failureCount < 2`라 첫 실패 뒤 backoff로 들어가는데, 그 창이
 * `status: "pending"` · `error: null` · `failureReason: 봉투`다. 추방이 실제로 나타나는
 * 모양이 이것이고, `error`가 찰 때까지 기다리면 그 사이 사용자는 빈 화면을 본다.
 */
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
  route.search = "";
  route.replaceMock.mockReset();
  route.shellError = null;
  route.workspaceFetch = () => new Promise(() => {});
  route.recording = null;
  route.disconnectMock.mockReset();
  route.toastMock.mockReset();
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

  it("keeps the workspace page mounted for a full-screen note (sidebar retained)", () => {
    route.noteId = "note-1";
    route.search = "view=full&tab=transcript";

    renderLayout(makeQueryClient(), <div>전체 화면 노트</div>);

    // v5: full 모드도 사이드바를 유지하므로 허브 페이지가 셸 안에 계속 마운트된다.
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
    // 경계가 잡은 예외를 React가 콘솔에 다시 뱉는다. 테스트 출력은 깨끗해야 한다.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // **`error`는 재시도를 다 소진해야 채워진다.** 그 전에 `fetchStatus`가 `paused`로 넘어가면
  // 영영 안 채워지고, 그것을 기다리는 동안 사용자는 골격만 남은 화면을 본다 — 새로고침하면
  // 빈 화면이던 것의 정체다.
  it("재시도가 남아 있어도 첫 실패에 내보낸다", async () => {
    const client = makeQueryClient();
    let attempts = 0;
    route.workspaceFetch = () => {
      attempts += 1;
      return Promise.reject(GONE);
    };

    renderLayout(client);

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    // **요청 한 번으로 결론이 났다.** 전역 정책은 404에도 두 번 더 보내고 `error`는 그
    // 셋이 끝나야 찬다 — 그것을 기다렸다면 여기서 3이 나오거나(또는 `paused`에 걸려)
    // 이동 자체가 없었다.
    expect(attempts).toBe(1);
  });

  // **보고 있는 중에 추방되면 아무 신호도 안 온다.** 상세 조회는 staleTime 60초 + 전역
  // `refetchOnWindowFocus: false`라 가만히 있으면 재조회가 안 나가서, 사용자는 이미 접근할
  // 수 없는 화면에 그대로 머물렀다. 주기적으로 다시 물어봐야 안다.
  it("보고 있는 중에 추방되면 다음 확인에서 내보낸다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeQueryClient();
    // 처음엔 멤버다 — 화면이 정상으로 뜬다.
    route.workspaceFetch = () =>
      Promise.resolve({
        status: 200,
        data: { success: true, data: { workspaceId: WORKSPACE_ID } },
      });

    renderLayout(client);
    await waitFor(() => expect(stateOf(client)?.status).toBe("success"));
    expect(route.replaceMock).not.toHaveBeenCalled();

    // 다른 관리자가 내보냈다. 화면은 그대로이고 사용자가 할 행동은 아무것도 없다.
    route.workspaceFetch = alwaysGone();
    await vi.advanceTimersByTimeAsync(30_000);

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    vi.useRealTimers();
  });

  // 홈의 「대시보드로 이동」은 워크스페이스 목록을 staleTime 5분으로 들고 있다. 그대로 두면
  // 방금 쫓겨난 워크스페이스를 다시 가리켜 같은 자리로 돌려보낸다.
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

  // 첫 진입부터 404면(남의 워크스페이스 URL 등) 캐시가 없어 경계까지 던져진다. 위 훅이
  // 이동을 맡으므로 여기서는 재시도 화면이 번쩍이지 않게만 한다.
  it("첫 진입 404는 재시도를 그리지 않는다", () => {
    route.shellError = GONE;

    renderLayout(makeQueryClient());

    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });

  // 네트워크·500은 재시도가 의미 있는 실패다. 여기까지 홈으로 보내면 잠깐 끊긴 것뿐인데
  // 보던 워크스페이스에서 쫓겨난다.
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

/**
 * 추방은 화면만 옮기면 끝이 아니다. 녹음은 route를 넘어 살아 있어서(`RecordingProvider`가
 * `app/providers.tsx`에 있다) 그냥 두면 **이미 접근할 수 없는 노트로 음성을 계속 보낸다.**
 *
 * `stop()`이 아니라 `disconnect()`다 — 이미 비멤버라 세션 종료 API가 404로 떨어진다.
 * 로컬 정리만 가능하다.
 */
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

  // A를 녹음한 채 B를 보다가 **A에서** 추방당할 수 있다. 그때 B의 화면이 A의 녹음을
  // 끊으면 사용자가 하던 녹음이 이유 없이 죽는다.
  it("다른 워크스페이스를 녹음 중이면 건드리지 않는다", async () => {
    route.workspaceFetch = alwaysGone();
    route.recording = recordingIn(OTHER_WORKSPACE_ID);

    renderLayout(makeQueryClient());

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    expect(route.disconnectMock).not.toHaveBeenCalled();
  });
});

/**
 * 갑자기 랜딩 페이지로 튕기면 사용자에게는 버그로 보인다. 왜 나갔는지 한 줄은 있어야 한다.
 *
 * 토스트가 맞다 — 방금 일어난 일에 대한 알림이라 사라져도 된다(rule `error-loading`).
 * 서버 문구(「워크스페이스를 찾을 수 없습니다」)를 그대로 쓰지 않는다. 사용자에게 필요한 건
 * 존재 여부가 아니라 **자기가 나가졌다는 사실**이고, 404는 서버가 비멤버에게 존재를 숨기는
 * 수단일 뿐이다.
 */
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
    // 먼저 멤버로 한 번 들어간다 — 이 데이터가 「원래 내 것이었다」의 근거다.
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
        "이 워크스페이스에서 나가게 되었습니다.",
        expect.objectContaining({ id: expect.any(String) })
      )
    );
    vi.useRealTimers();
  });

  // **나가기 DELETE와 30초 폴링이 겹칠 수 있다.** 서버에서 탈퇴가 먼저 커밋되고 그 GET의
  // 404가 DELETE의 204보다 먼저 도착하면, 캐시에는 아직 성공 데이터가 남아 있어 내가 누른
  // 나가기에 「나가게 되었습니다」가 뜬다.
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

    // 나가기 요청이 아직 떠 있다.
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

  // **들어온 적이 없으면 나가진 것도 아니다.** 남의 워크스페이스 URL을 붙여넣으면 첫 조회부터
  // 404다. 홈으로 보내는 것은 맞지만 「나가게 되었습니다」는 거짓말이다.
  //
  // 자발적 나가기도 같은 조건에 걸린다 — 나가기가 `forgetWorkspace`로 상세 조회를 지우고
  // 이동하므로, 지워진 자리에 새로 뜬 조회에는 데이터가 없다.
  it("한 번도 들어가 본 적 없는 곳이면 안 띄운다", async () => {
    route.workspaceFetch = alwaysGone();

    renderLayout(makeQueryClient());

    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
    expect(route.toastMock).not.toHaveBeenCalled();
  });
});
