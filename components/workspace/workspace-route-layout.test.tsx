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
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ noteId: route.noteId }),
  useSearchParams: () => new URLSearchParams(route.search),
  useRouter: () => ({ replace: route.replaceMock }),
}));

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
