import { act } from "react";
import { useSyncExternalStore } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  WorkspaceAppShell,
  useOpenSettings,
} from "@/components/workspace/workspace-app-shell";

const navState = vi.hoisted(() => ({
  pathname: "/w/01K0000000000",
  push: vi.fn(),
  replace: vi.fn(),
}));
// Next 16 은 pushState/replaceState/popstate 를 라우터와 통합해 `useSearchParams` 를 갱신한다 — 같은 일을 흉내 낸다.
function subscribeLocation(notify: () => void) {
  window.addEventListener("locationchange", notify);
  window.addEventListener("popstate", notify);
  return () => {
    window.removeEventListener("locationchange", notify);
    window.removeEventListener("popstate", notify);
  };
}
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navState.push, replace: navState.replace }),
  useSearchParams: () => {
    const search = useSyncExternalStore(
      subscribeLocation,
      () => window.location.search,
      () => ""
    );
    return new URLSearchParams(search);
  },
  usePathname: () => navState.pathname,
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({ toast: toastMock }));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    session: null,
    elapsedMs: 0,
    error: null,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  }),
  useIsRecordingBusy: () => false,
  useRecordingMeter: () => ({
    level: 0,
    levelHistory: [0, 0, 0, 0],
  }),
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspacesQueryKey: () => ["workspaces"],
  useGetWorkspaces: () => ({
    data: { status: 200, data: { success: true, data: { workspaces: [] } } },
  }),
  useCreateWorkspace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetWorkspaceSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaceId: "01K0000000000",
          name: "김민수의 워크스페이스",
        },
      },
    },
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { name: "김민수", email: "minsu@example.com" } }),
  useAuthUserId: () => "01K0000000003",
}));

const projectState = vi.hoisted(() => ({
  projects: [] as { projectId: string; name: string }[],
  create: vi.fn(),
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectsQueryKey: () => ["projects"],
  useGetProjectsSuspense: () => ({
    data: {
      status: 200,
      data: { success: true, data: { projects: projectState.projects } },
    },
    isPending: false,
    isError: false,
  }),
  useCreateProject: () => ({
    mutateAsync: projectState.create,
    isPending: false,
  }),
  useUpdateProject: () => ({ mutateAsync: vi.fn() }),
  useDeleteProject: () => ({ mutateAsync: vi.fn() }),
}));

// 체크리스트는 따로 시험한다(`lib/onboarding/checklist.test.ts`). 여기서는 셸만 본다.
vi.mock("@/components/workspace/onboarding-checklist", () => ({
  OnboardingChecklist: () => null,
  useOnboardingChecklist: () => null,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNotesQueryKey: () => ["notes"],
  useCreateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetNote: () => ({ data: undefined }),
}));

function visit(search: string) {
  window.history.replaceState(null, "", `/w/01K0000000000${search}`);
}

// 탭 내용은 따로 시험한다(`settings-dialog.test.tsx`). 여기서는 창과 주소만 본다.
vi.mock("@/components/settings/account-settings-form", () => ({
  AccountSettingsForm: () => <p>계정 내용</p>,
  AccountSettingsFormSkeleton: () => <p>계정 로딩</p>,
}));
vi.mock("@/components/settings/workspace-settings-form", () => ({
  WorkspaceSettingsForm: () => <p>워크스페이스 내용</p>,
  WorkspaceSettingsFormSkeleton: () => <p>워크스페이스 로딩</p>,
}));
vi.mock("@/components/settings/members-settings", () => ({
  MembersSettings: () => <p>멤버 내용</p>,
}));
vi.mock("@/components/settings/guests-settings", () => ({
  GuestsSettings: () => <p>임시 참여자 내용</p>,
}));
vi.mock("@/components/terms/workspace-terms-settings", () => ({
  WorkspaceTermsSettings: () => <p>용어 사전 내용</p>,
}));
vi.mock("@/components/settings/workspace-integrations-settings", () => ({
  WorkspaceIntegrationsSettings: () => <p>연동 내용</p>,
}));
vi.mock("@/components/settings/workspace-agent-access-settings", () => ({
  WorkspaceAgentAccessSettings: () => <p>외부 에이전트 관리 내용</p>,
}));
vi.mock("@/components/settings/agent-connections-settings", () => ({
  AgentConnectionsSettings: () => <p>내 연결 내용</p>,
}));

describe("WorkspaceAppShell", () => {
  beforeAll(() => {
    for (const method of ["pushState", "replaceState"] as const) {
      const native = window.history[method].bind(window.history);
      window.history[method] = (...args) => {
        native(...args);
        window.dispatchEvent(new Event("locationchange"));
      };
    }
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  beforeEach(() => {
    window.history.replaceState(null, "", "/w/01K0000000000");
    navState.pathname = "/w/01K0000000000";
    navState.push.mockClear();
    navState.replace.mockClear();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    projectState.projects = [];
    projectState.create.mockReset();
    projectState.create.mockResolvedValue({
      status: 201,
      data: { success: true, data: { projectId: "01K0000000001" } },
    });
  });

  // 이 파일은 셸을 통째로 마운트한다 — 안 치우면 앞 테스트가 남긴 트리의 입력이
  // `screen` 질의에 함께 걸려서 "창이 닫혔는가"를 물을 수 없다.
  afterEach(cleanup);

  it("renders one app navigation and a main content region", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("navigation", { name: "워크스페이스" })
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("노트 목록");
    expect(screen.getAllByText("김민수의 워크스페이스")).not.toHaveLength(0);

    // 셸이 캔버스를 꽉 채우지 않는다 — 사이드바는 캔버스 위에 그냥 앉고(배경·테두리 없음)
    // 본문만 둥근 흰 패널로 뜬다(design.pen `IUax1`). 예전에는 사이드바에 `border-r`이 있어
    // 두 면이 한 셸처럼 붙어 있었다.
    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]'
    );
    expect(sidebarContainer).toHaveClass("overflow-hidden", "bg-transparent");
    expect(sidebarContainer?.className).not.toMatch(/(^|\s|:)border-r(\s|$)/);

    const panel = screen
      .getByRole("main")
      .closest("[data-slot='sidebar-inset']")
      ?.querySelector(".rounded-panel");
    expect(panel).not.toBeNull();
    expect(panel).toHaveClass(
      "rounded-panel",
      "border",
      "border-[var(--el-hairline)]"
    );
  });

  it("할 일 화면에서는 상단바가 할 일을 말하고, 모든 노트는 목록으로 가는 링크다", () => {
    navState.pathname = "/w/01K0000000000/tasks";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>할 일 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    expect(
      within(screen.getByRole("main")).getAllByText("할 일").length
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "모든 노트" })).toHaveAttribute(
      "href",
      "/w/01K0000000000"
    );
    expect(navState.push).not.toHaveBeenCalled();
  });

  it("OAuth 복귀 쿼리로 연동 결과 토스트를 띄우고 쿼리를 지운다", async () => {
    visit("?provider=LINEAR&status=connected");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        "Linear 연동을 연결했습니다."
      );
    });
    // 라우터 왕복 없이 주소만 바꾼다 — 복귀 항목이 곧 `?settings=integrations` 다.
    expect(navState.replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?settings=integrations");
    expect(await screen.findByRole("button", { name: "연동" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("status가 connected가 아니면 실패 토스트를 띄운다", async () => {
    visit("?provider=GITHUB&status=error");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "연동 연결에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    });
  });
  /**
   * 프로젝트가 없는 워크스페이스에서 「새 노트」를 누르면 **프로젝트를 먼저 묻고, 만든 뒤
   * 회의 창으로 이어진다.** 예전에는 그 버튼이 그냥 비활성이었고, 유일한 입구인 사이드바
   * 「프로젝트 만들기」는 절차의 1단계로 읽히지 않았다.
   */
  it("프로젝트가 없으면 새 노트가 프로젝트 만들기부터 이어 붙인다", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));
    // 회의 이름이 아니라 프로젝트 이름을 먼저 묻는다.
    expect(
      screen.getByRole("dialog", { name: "첫 프로젝트 만들기" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("회의 이름")).toBeNull();

    fireEvent.change(screen.getByLabelText("프로젝트 이름"), {
      target: { value: "주간" },
    });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => {
      expect(projectState.create).toHaveBeenCalledWith({
        workspaceId: "01K0000000000",
        data: { name: "주간", description: null },
      });
      // 절차가 끊기지 않는다 — 프로젝트를 만들면 회의 창이 바로 이어진다.
      expect(screen.getByLabelText("회의 이름")).toBeInTheDocument();
    });
  });

  it("프로젝트가 있으면 새 노트가 곧장 회의 이름을 묻는다", () => {
    projectState.projects = [{ projectId: "01K0000000001", name: "주간" }];
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));

    expect(screen.getByLabelText("회의 이름")).toBeInTheDocument();
    expect(screen.queryByLabelText("프로젝트 이름")).toBeNull();
  });

  it("전체 노트 화면이 셸을 덮으면 열려 있던 만들기 창을 닫는다", () => {
    // 창은 포털(`z-50`)이라 `inert`도 덮는 면(`z-30`)도 닿지 않는다. 셸은 노트로 이동해도
    // 재마운트되지 않으니 저절로 사라지지도 않아, 허브에서 열어 둔 창이 노트 위에 남았다.
    projectState.projects = [{ projectId: "01K0000000001", name: "주간" }];
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));
    expect(screen.getByLabelText("회의 이름")).toBeInTheDocument();

    visit("?view=full");
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell
          workspaceId="01K0000000000"
          activeNoteId="01K0000000002"
        >
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    expect(screen.queryByLabelText("회의 이름")).toBeNull();
  });

  describe("설정 창 주소 (APP-1211)", () => {
    // 사이드바·체크리스트·채팅 카드는 모두 이 컨텍스트 함수로 연다 — 같은 길 하나다.
    function Opener() {
      const openSettings = useOpenSettings();
      return (
        <button type="button" onClick={() => openSettings?.("account")}>
          설정 열기
        </button>
      );
    }
    const mount = () =>
      render(
        <QueryClientProvider client={new QueryClient()}>
          <WorkspaceAppShell workspaceId="01K0000000000">
            <Opener />
          </WorkspaceAppShell>
        </QueryClientProvider>
      );
    const dialogOpen = () => screen.queryByRole("dialog", { name: "설정" });

    it("사이드바에서 열면 push, 탭 바꾸기는 replace 라 기록이 하나만 쌓인다", async () => {
      mount();
      const before = window.history.length;
      fireEvent.click(screen.getByRole("button", { name: "설정 열기" }));
      expect(await screen.findByRole("dialog", { name: "설정" })).toBeTruthy();
      expect(window.location.search).toBe("?settings=account");
      expect(window.history.length).toBe(before + 1);

      fireEvent.click(screen.getByRole("button", { name: "멤버" }));
      expect(window.location.search).toBe("?settings=members");
      expect(window.history.length).toBe(before + 1);
    });

    it("push 로 연 창은 닫을 때 back() 으로 그 항목을 걷는다", async () => {
      window.history.replaceState(null, "", "/w/01K0000000000?newMeeting=x");
      mount();
      const back = vi
        .spyOn(window.history, "back")
        .mockImplementation(() => {});
      fireEvent.click(screen.getByRole("button", { name: "설정 열기" }));
      await screen.findByRole("dialog", { name: "설정" });
      // 다른 쿼리는 그대로 병합된다
      expect(window.location.search).toContain("settings=account");
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
      expect(back).toHaveBeenCalledTimes(1);
      back.mockRestore();
    });

    it("딥링크로 열린 창은 닫을 때 쿼리만 지운다(기록 불변, back 안 씀)", async () => {
      visit("?settings=members&q=1");
      mount();
      expect(await screen.findByRole("dialog", { name: "설정" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "멤버" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      const back = vi
        .spyOn(window.history, "back")
        .mockImplementation(() => {});
      const length = window.history.length;
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
      await waitFor(() => expect(dialogOpen()).toBeNull());
      expect(back).not.toHaveBeenCalled();
      expect(window.location.search).toBe("?q=1");
      expect(window.history.length).toBe(length);
      back.mockRestore();
    });

    it("뒤로 가기(popstate)로 주소에서 settings 가 빠지면 창이 닫힌다", async () => {
      visit("?settings=guests");
      mount();
      await screen.findByRole("dialog", { name: "설정" });
      act(() => {
        window.history.replaceState(null, "", "/w/01K0000000000");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await waitFor(() => expect(dialogOpen()).toBeNull());
    });

    it("모르는 값은 기본 탭(워크스페이스 일반)으로 열고 주소를 고친다", async () => {
      visit("?settings=nope");
      mount();
      expect(await screen.findByRole("dialog", { name: "설정" })).toBeTruthy();
      await waitFor(() =>
        expect(window.location.search).toBe("?settings=workspace")
      );
      expect(screen.getByRole("button", { name: "일반" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });

    it("이미 열려 있으면 다른 자리에서 열어도 기록을 더 쌓지 않는다", async () => {
      visit("?settings=members");
      mount();
      await screen.findByRole("dialog", { name: "설정" });
      const length = window.history.length;
      fireEvent.click(screen.getByRole("button", { name: "연동" }));
      expect(window.history.length).toBe(length);
      expect(window.location.search).toBe("?settings=integrations");
    });
  });
});
