import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceRouteLayout } from "@/components/workspace/workspace-route-layout";

const route = vi.hoisted(() => ({
  noteId: undefined as string | undefined,
  search: "",
  replaceMock: vi.fn(),
  /** 셸이 렌더 중 던질 것. null이면 정상 렌더다. */
  shellError: null as unknown,
  /**
   * 워크스페이스 조회가 들고 있는 오류. **캐시된 데이터가 있으면 배경 재조회가 실패해도
   * suspense 훅은 경계로 던지지 않는다**(실측) — 그래서 셸은 멀쩡히 그려지는데 이 값만 찬다.
   * 추방이 실제로 일어나는 모양이 이것이다.
   */
  workspaceError: null as unknown,
  removeQueriesMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
  setQueryDataMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ noteId: route.noteId }),
  useSearchParams: () => new URLSearchParams(route.search),
  useRouter: () => ({ replace: route.replaceMock }),
}));
vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>(
      "@tanstack/react-query"
    );
  return {
    ...actual,
    useQueryClient: () => ({
      removeQueries: route.removeQueriesMock,
      invalidateQueries: route.invalidateQueriesMock,
      setQueryData: route.setQueryDataMock,
    }),
  };
});
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspace: () => ({ error: route.workspaceError }),
  getGetWorkspaceQueryKey: (id: string) => ["workspace", id],
  getGetWorkspacesQueryKey: () => ["workspaces"],
}));

vi.mock("@/components/workspace/workspace-app-shell", () => ({
  WorkspaceAppShell: ({
    activeNoteId,
    children,
  }: {
    activeNoteId?: string;
    children: React.ReactNode;
  }) => {
    // 셸 안의 워크스페이스 조회가 실패한 상황을 재현한다. suspense 훅이 던지는 자리다.
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

describe("WorkspaceRouteLayout", () => {
  afterEach(cleanup);

  beforeEach(() => {
    route.noteId = undefined;
    route.search = "";
    route.replaceMock.mockReset();
    route.shellError = null;
    route.workspaceError = null;
    route.removeQueriesMock.mockReset();
    route.invalidateQueriesMock.mockReset();
    route.setQueryDataMock.mockReset();
  });

  it("keeps the workspace page mounted behind a side note", () => {
    route.noteId = "note-1";
    route.search = "view=side&tab=transcript";

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div>노트 패널</div>
      </WorkspaceRouteLayout>
    );

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

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div>전체 화면 노트</div>
      </WorkspaceRouteLayout>
    );

    // v5: full 모드도 사이드바를 유지하므로 허브 페이지가 셸 안에 계속 마운트된다.
    expect(screen.getByText("워크스페이스 목록")).toBeInTheDocument();
    expect(screen.getByText("전체 화면 노트")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-active-note-id",
      "note-1"
    );
  });
});

describe("워크스페이스 조회가 실패했을 때", () => {
  beforeEach(() => {
    route.noteId = undefined;
    route.search = "";
    route.replaceMock.mockReset();
    route.shellError = null;
    route.workspaceError = null;
    route.removeQueriesMock.mockReset();
    route.invalidateQueriesMock.mockReset();
    route.setQueryDataMock.mockReset();
    // ErrorBoundary가 잡은 예외를 React가 콘솔에 다시 뱉는다. 테스트 출력은 깨끗해야 한다.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // **이것이 추방이 실제로 일어나는 모양이다.** 화면을 보고 있는 중에 멤버십이 사라지면
  // 배경 재조회만 404가 되는데, 캐시된 데이터가 남아 있어 suspense 훅은 경계로 던지지 않는다
  // (격리 재현으로 확인). 셸은 멀쩡히 그려지고 사용자는 이미 접근할 수 없는 화면을 계속 본다.
  it("보고 있던 중에 추방되면 화면이 남아 있어도 홈으로 보낸다", async () => {
    route.workspaceError = {
      success: false,
      data: null,
      error: {
        code: "WORKSPACE_NOT_FOUND",
        message: "워크스페이스를 찾을 수 없습니다.",
      },
    };

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div />
      </WorkspaceRouteLayout>
    );

    // 경계는 아무것도 잡지 않았다 — 셸이 그대로 그려져 있다.
    expect(screen.getByTestId("workspace-shell")).toBeInTheDocument();
    await waitFor(() => expect(route.replaceMock).toHaveBeenCalledWith("/"));
  });

  // 홈의 「대시보드로 이동」은 워크스페이스 목록을 staleTime 5분으로 들고 있다. 그대로 두면
  // 방금 쫓겨난 워크스페이스를 다시 가리켜 같은 자리로 돌려보낸다.
  it("이동 전에 죽은 워크스페이스와 목록 캐시를 정리한다", async () => {
    route.workspaceError = {
      success: false,
      data: null,
      error: { code: "WORKSPACE_NOT_FOUND", message: "없음" },
    };

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div />
      </WorkspaceRouteLayout>
    );

    await waitFor(() => {
      expect(route.removeQueriesMock).toHaveBeenCalledWith({
        queryKey: ["workspace", "workspace-1"],
      });
      expect(route.invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: ["workspaces"],
      });
      // 무효화 전에 목록에서 직접 빼야 재조회가 늦거나 실패해도 죽은 항목이 안 보인다.
      expect(route.setQueryDataMock).toHaveBeenCalled();
    });
  });

  // 첫 진입부터 404면(남의 워크스페이스 URL 등) 캐시가 없어 경계까지 던져진다. 위 훅이
  // 이동을 맡으므로 여기서는 재시도 화면이 번쩍이지 않게만 한다.
  /**
   * **골격은 곧 나타날 화면과 같은 모양이어야 한다.** 전체 뷰는 사이드바도 워크스페이스
   * 상단바도 통째로 덮는데(design.pen `XtEMZ`), 워크스페이스 골격을 그리면 보일 리 없는
   * 사이드바가 잠깐 뜬 다음 노트가 그 위를 덮는다 — 「같은 화면이 채워지는 중」이 아니라
   * 화면이 통째로 갈리는 것으로 보인다.
   *
   * suspense가 아니라 첫 진입 404 경로로 재현한다 — 둘이 같은 fallback을 쓴다.
   */
  it.each([
    ["view=full&tab=transcript", "노트 불러오는 중", "워크스페이스 불러오는 중"],
    ["view=side&tab=transcript", "워크스페이스 불러오는 중", "노트 불러오는 중"],
  ])("%s 골격은 %s다", (search, shown, hidden) => {
    route.noteId = "note-1";
    route.search = search;
    route.shellError = {
      success: false,
      data: null,
      error: { code: "WORKSPACE_NOT_FOUND", message: "없음" },
    };

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div />
      </WorkspaceRouteLayout>
    );

    expect(screen.getByLabelText(shown)).toBeInTheDocument();
    expect(screen.queryByLabelText(hidden)).toBeNull();
  });

  it("첫 진입 404는 재시도를 그리지 않는다", async () => {
    route.shellError = {
      success: false,
      data: null,
      error: {
        code: "WORKSPACE_NOT_FOUND",
        message: "워크스페이스를 찾을 수 없습니다.",
      },
    };

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div />
      </WorkspaceRouteLayout>
    );

    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });

  // 네트워크·500은 재시도가 의미 있는 실패다. 여기까지 홈으로 보내면 잠깐 끊긴 것뿐인데
  // 보던 워크스페이스에서 쫓겨난다.
  it("다른 실패는 재시도를 그대로 그리고 이동하지 않는다", async () => {
    route.shellError = new Error("Network request failed");

    render(
      <WorkspaceRouteLayout workspaceId="workspace-1">
        <div />
      </WorkspaceRouteLayout>
    );

    expect(
      await screen.findByRole("button", { name: "다시 시도" })
    ).toBeInTheDocument();
    expect(route.replaceMock).not.toHaveBeenCalled();
  });
});
