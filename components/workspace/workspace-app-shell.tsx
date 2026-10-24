"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "@/lib/ui/toast";
import { track } from "@/lib/analytics/track";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersonalChatProvider } from "@/components/chat/personal-chat";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { NotificationCenterProvider } from "@/components/notification/notification-center";
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_PARAM,
  clearSettings,
  hasSettingsParam,
  parseSettingsSection,
  pushSettings,
  replaceSettings,
  type SettingsSection,
} from "@/lib/workspace/settings-url";
import { CreateProjectDialog } from "@/components/workspace/create-project-dialog";
import { NewMeetingDialog } from "@/components/workspace/new-meeting-dialog";
import {
  OnboardingChecklist,
  useOnboardingChecklist,
} from "@/components/workspace/onboarding-checklist";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { useCreateMeeting } from "@/lib/workspace/use-create-meeting";
import type {
  ProjectResponseData,
  WorkspaceResponseData,
} from "@/lib/api/generated/models";
import { useGetProjectsSuspense } from "@/lib/api/generated/projects/projects";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";

type WorkspaceShellState = {
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  openSettings: (section: SettingsSection) => void;
  /** 프로젝트 만들기 창을 연다. 사이드바 머리글의 `+`와 빈 상태 CTA가 쓴다. */
  openCreateProject: () => void;
  /**
   * 새 회의를 만들려 한다. **프로젝트가 없으면 프로젝트부터 묻고 이어서 회의 창을 연다** —
   * 노트는 프로젝트 안에만 생기는데, 예전에는 상단바 버튼이 그냥 비활성이라 왜 못 누르는지도
   * 무엇을 먼저 해야 하는지도 화면에 없었다.
   */
  requestNewMeeting: () => void;
  workspace?: WorkspaceResponseData;
  projects: ProjectResponseData[];
  isWorkspacePending: boolean;
  isWorkspaceError: boolean;
};

const INTEGRATION_LABEL: Record<string, string> = {
  LINEAR: "Linear",
  GITHUB: "GitHub",
};

const WorkspaceShellContext = createContext<WorkspaceShellState | null>(null);

/**
 * 설정을 열 수 있으면 여는 함수를, 워크스페이스 셸 밖이면 `null` 을 돌려준다. 셸 밖에서도 그려지는
 * 컴포넌트가 「설정으로 가기」를 선택으로 얹을 때 쓴다 — `useWorkspaceShell` 은 셸 밖에서 던진다.
 */
export function useOpenSettings() {
  return useContext(WorkspaceShellContext)?.openSettings ?? null;
}

/** 새 회의 창을 여는 함수. 셸 밖이면 `null` 이다(`useOpenSettings` 와 같은 이유). */
export function useRequestNewMeeting() {
  return useContext(WorkspaceShellContext)?.requestNewMeeting ?? null;
}

export function useWorkspaceShell() {
  const context = useContext(WorkspaceShellContext);
  if (!context) {
    throw new Error("useWorkspaceShell must be used inside WorkspaceAppShell");
  }
  return context;
}

export function WorkspaceAppShell({
  workspaceId,
  activeNoteId,
  children,
}: {
  workspaceId: string;
  activeNoteId?: string;
  children: React.ReactNode;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // **첫 커밋 뒤에만 URL을 읽고 쓴다.** 링크로 바로 들어오면 셸이 첫 hydration과 함께 마운트되는데,
  // 그때 자식 effect는 App Router가 `history.replaceState`를 패치하기 전에 돈다 — 네이티브
  // 호출이 되어 현재 엔트리의 라우터 상태를 지우고 `useSearchParams`도 안 바뀐다
  // (`note-view` 의 `isOpen` 게이트와 같은 이유). 서버는 쿼리를 알아도 창은 클라이언트에서만 열린다.
  const [committed, setCommitted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 첫 커밋을 표시하는 것 자체가 목적이다
  useEffect(() => setCommitted(true), []);

  // 설정 창은 주소(`?settings=<section>`)가 단일 출처다(APP-1211). 열기·탭 바꾸기·닫기는 모두
  // `history.pushState/replaceState` 로 쓰고(rule `architecture`), 새로고침·딥링크·뒤로 가기는
  // 주소가 그대로 되살린다. 모르는 값은 기본 탭으로 열고 아래 effect 가 주소를 고친다.
  const settingsParam = searchParams.get(SETTINGS_PARAM);
  const urlSection =
    settingsParam === null
      ? null
      : (parseSettingsSection(settingsParam) ?? DEFAULT_SETTINGS_SECTION);
  const settingsOpen = committed && urlSection !== null;
  // 닫히는 동안(페이드)에도 마지막 탭을 그린다 — 주소에서 값이 사라져도 내용이 기본 탭으로 뒤집히지 않게.
  const [shownSection, setShownSection] = useState<SettingsSection>(
    DEFAULT_SETTINGS_SECTION
  );
  if (urlSection !== null && urlSection !== shownSection) {
    setShownSection(urlSection);
  }
  /** 이 세션에서 우리가 창을 `push` 로 열었다 — 닫을 때 그 항목을 `back()` 으로 걷는다. */
  const pushedRef = useRef(false);
  const openSettings = useCallback((section: SettingsSection) => {
    if (hasSettingsParam()) {
      replaceSettings(section);
      return;
    }
    pushSettings(section);
    pushedRef.current = true;
  }, []);
  const closeSettings = useCallback(() => {
    // 열 때 쌓은 항목이 남아 있으면 되돌아가 기록을 늘리지 않는다. 딥링크·새로고침·OAuth 복귀로
    // 열린 창에는 걷을 항목이 없다 — 쿼리만 지운다(그때 `back()` 은 사이트 밖으로 나간다).
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else {
      clearSettings();
    }
  }, []);
  useEffect(() => {
    if (!committed || settingsParam === null) return;
    if (parseSettingsSection(settingsParam) === null) {
      pushedRef.current = false;
      replaceSettings(DEFAULT_SETTINGS_SECTION);
    }
  }, [committed, settingsParam]);

  // OAuth 연동 승인 후 서버가 /w/{workspaceId}?provider=&status=로 돌려보낸다(APP-194).
  // 연동 설정 창을 열어 결과를 보이고, 새로고침·뒤로가기에 재실행되지 않게 쿼리를 지운다.
  // 복귀 항목 자체를 `?settings=integrations` 로 바꾼다(replace) — 걷을 push 항목이 없으니 닫기는 쿼리 제거다.
  useEffect(() => {
    if (!committed) return;
    // 렌더 값이 아니라 주소를 본다 — StrictMode 의 두 번째 실행이 토스트를 또 띄우지 않게.
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    if (!provider) return;
    const status = params.get("status");
    if (status === "connected") {
      track("integration_connected", { provider });
      toast.success(
        `${INTEGRATION_LABEL[provider] ?? provider} 연동을 연결했습니다.`
      );
    } else {
      toast.error("연동 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
    pushedRef.current = false;
    replaceSettings("integrations", ["provider", "status"]);
  }, [committed, searchParams]);

  // suspense — 로딩/에러는 route-layout의 DataBoundary가 잡는다. isPending/isError는 항상 false라
  // context 인터페이스(workspace-page가 소비)는 그대로 두어도 값이 자연히 false가 된다.
  const workspaceQuery = useGetWorkspaceSuspense(workspaceId);
  const projectsQuery = useGetProjectsSuspense(workspaceId);
  const workspace =
    workspaceQuery.data?.status === 200 && workspaceQuery.data.data.success
      ? workspaceQuery.data.data.data
      : undefined;
  const projects = useMemo(
    () =>
      projectsQuery.data?.status === 200 && projectsQuery.data.data.success
        ? (projectsQuery.data.data.data.projects ?? [])
        : [],
    [projectsQuery.data]
  );
  // 「시작하기」의 판단·조회·기록은 늘 떠 있는 셸이 한다 — 사이드바는 모바일에서 닫히면 사라지는 시트다.
  const onboarding = useOnboardingChecklist({
    workspaceId,
    isWorkspacePending: workspaceQuery.isPending || projectsQuery.isPending,
  });
  /**
   * 프로젝트 만들기 창의 상태. **왜 열렸는지를 함께 담는다** — 「새 노트」에서 온 것이면
   * 만든 뒤 회의 창으로 이어 가고, 사이드바 `+`에서 온 것이면 거기서 끝난다.
   */
  const [createProject, setCreateProject] = useState<
    null | "standalone" | "then-meeting"
  >(null);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const hasProject = projects.length > 0;
  const openCreateProject = useCallback(
    () => setCreateProject("standalone"),
    []
  );
  const requestNewMeeting = useCallback(() => {
    if (hasProject) {
      setNewMeetingOpen(true);
      return;
    }
    setCreateProject("then-meeting");
  }, [hasProject]);

  // 외부 에이전트의 「회의를 시작하자」가 돌려준 주소(`/w/{ws}/notes/new?projectId=`)가
  // `?newMeeting=` 으로 넘어온다(APP-802). 그 프로젝트를 고르고 새 회의 창만 연다 — 노트는
  // 사람이 제목을 넣고 만들어야 생기고, 창을 닫으면 아무것도 남지 않는다. 목록에 없는
  // 프로젝트는 없든 권한 밖이든 같은 안내 하나다. 다시 열리지 않게 쿼리를 걷는다 — 같은
  // 화면의 상태라 라우터가 아니라 `history.replaceState` 다(rule `architecture`).
  const newMeetingProjectId = searchParams.get("newMeeting");
  useEffect(() => {
    if (!committed || !newMeetingProjectId) return;
    // URL 쿼리(외부 상태)에 반응해 창을 여는 동기화 — 위 `?provider=` 와 같은 자리다.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (projects.some((project) => project.projectId === newMeetingProjectId)) {
      setSelectedProjectId(newMeetingProjectId);
      setNewMeetingOpen(true);
    } else {
      toast.error("회의를 시작할 프로젝트를 찾을 수 없습니다.");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    const next = new URLSearchParams(searchParams);
    next.delete("newMeeting");
    const query = next.toString();
    window.history.replaceState(
      null,
      "",
      `${pathname}${query ? `?${query}` : ""}`
    );
  }, [committed, newMeetingProjectId, projects, searchParams, pathname]);

  const value = useMemo(
    () => ({
      selectedProjectId,
      setSelectedProjectId,
      openSettings,
      openCreateProject,
      requestNewMeeting,
      workspace,
      projects,
      isWorkspacePending: workspaceQuery.isPending || projectsQuery.isPending,
      isWorkspaceError: workspaceQuery.isError || projectsQuery.isError,
    }),
    [
      openCreateProject,
      openSettings,
      projects,
      projectsQuery.isPending,
      projectsQuery.isError,
      requestNewMeeting,
      selectedProjectId,
      workspace,
      workspaceQuery.isPending,
      workspaceQuery.isError,
    ]
  );
  const currentLabel =
    pathname === `/w/${workspaceId}/tasks`
      ? "할 일"
      : (projects.find((project) => project.projectId === selectedProjectId)
          ?.name ?? "모든 노트");
  // 노트 전체 화면은 이 셸을 통째로 덮는다(design.pen `XtEMZ`). side 시트는 안 덮는다.
  const isFullNote =
    Boolean(activeNoteId) && searchParams.get("view") !== "side";
  // 전체 화면이 셸을 덮으면 **셸이 연 창도 같이 닫는다.** 창은 포털(`z-50`)이라 `inert`도
  // 덮는 면(`z-30`)도 닿지 않고, 셸이 재마운트되지 않아 저절로 사라지지도 않는다 —
  // 허브에서 열어 둔 채 뒤로가기로 노트에 오면 노트 위에 갇힌 창이 남는다.
  // (설정 창은 주소에서 파생되므로 노트 주소로 가면 `settings` 가 없어 저절로 닫힌다.)
  if (isFullNote && (createProject || newMeetingOpen)) {
    setCreateProject(null);
    setNewMeetingOpen(false);
  }

  return (
    <WorkspaceShellContext.Provider value={value}>
      <PersonalChatProvider workspaceId={workspaceId}>
        <TooltipProvider>
          {/* 알림 개수와 모달은 셸이 한 번 소유한다 — 사이드바와 전체 화면 노트 헤더가 같은 것을 연다(PRO-67 I09). */}
          <NotificationCenterProvider
            workspaceId={workspaceId}
            onOpenSettings={openSettings}
          >
            <SettingsDialog
              open={settingsOpen}
              onOpenChange={(open) => !open && closeSettings()}
              section={shownSection}
              onSectionChange={replaceSettings}
              workspaceId={workspaceId}
            />
            {/* 셸이 캔버스를 꽉 채우지 않는다 — 사이드바는 캔버스 위에 그냥 앉고(배경·테두리 없음),
              본문만 둥근 흰 패널로 떠 있다. design.pen `IUax1`·`BviA2`. */}
            <SidebarProvider className="bg-[var(--el-canvas)]">
              {/* 노트 전체 화면이 이 사이드바를 **덮는다**. 시각적으로만 가리면 Tab이 보이지도
                않는 프로젝트 버튼에 들어가 Enter로 이동이 실행된다 — `inert`로 포커스·접근성
                트리에서 함께 뺀다. */}
              <Sidebar
                inert={isFullNote}
                className="overflow-hidden border-r-0 bg-transparent [&>[data-sidebar=sidebar]]:overflow-hidden [&>[data-sidebar=sidebar]]:bg-transparent"
              >
                <WorkspaceSidebar
                  workspaceId={workspaceId}
                  workspace={workspace}
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={setSelectedProjectId}
                  onOpenSettings={value.openSettings}
                  onCreateProject={openCreateProject}
                  covered={isFullNote}
                  onboarding={
                    onboarding && (
                      <OnboardingChecklist
                        workspaceId={workspaceId}
                        model={onboarding}
                      />
                    )
                  }
                />
              </Sidebar>
              <ShellMain
                workspaceId={workspaceId}
                currentLabel={currentLabel}
                activeNoteId={activeNoteId}
                isFullNote={isFullNote}
              >
                {children}
              </ShellMain>
              <CloseShellOverlaysOnFullNote isFullNote={isFullNote} />
              {/* 프로젝트·회의 만들기 창은 **셸이 소유한다.** 입구가 사이드바 `+`·상단바
                「새 노트」·빈 상태 CTA 셋이고, 그중 「새 노트」는 프로젝트가 없으면 프로젝트
                창을 먼저 열어야 하므로 두 창이 한 자리에 있어야 이어 붙일 수 있다.
                컨텍스트 안쪽 자식이다 — `useCreateMeeting`이 `useWorkspaceShell()`을 읽는다. */}
              <WorkspaceCreateDialogs
                workspaceId={workspaceId}
                createProject={createProject}
                onCreateProjectChange={setCreateProject}
                newMeetingOpen={newMeetingOpen}
                onNewMeetingChange={setNewMeetingOpen}
              />
            </SidebarProvider>
          </NotificationCenterProvider>
        </TooltipProvider>
      </PersonalChatProvider>
    </WorkspaceShellContext.Provider>
  );
}

/**
 * 프로젝트 만들기 → (첫 프로젝트였으면) 새 회의 만들기로 이어지는 두 창.
 *
 * 프로젝트를 만든 **직후에만** 회의 창이 이어진다. 처음 들어온 사람에게 절차가 끊기지 않게
 * 하려는 것이고, 사이드바 `+`로 만드는 둘째·셋째 프로젝트에는 이어 붙일 이유가 없다
 * (그때는 이미 회의를 만들어 본 사람이다).
 */
function WorkspaceCreateDialogs({
  workspaceId,
  createProject,
  onCreateProjectChange,
  newMeetingOpen,
  onNewMeetingChange,
}: {
  workspaceId: string;
  createProject: null | "standalone" | "then-meeting";
  onCreateProjectChange: (next: null | "standalone" | "then-meeting") => void;
  newMeetingOpen: boolean;
  onNewMeetingChange: (open: boolean) => void;
}) {
  const createMeeting = useCreateMeeting(workspaceId);
  const { selectedProjectId, projects } = useWorkspaceShell();
  const chain = createProject === "then-meeting";

  return (
    <>
      <CreateProjectDialog
        workspaceId={workspaceId}
        open={createProject !== null}
        first={chain}
        onOpenChange={(open) => !open && onCreateProjectChange(null)}
        onCreated={() => {
          if (chain) onNewMeetingChange(true);
        }}
      />
      <NewMeetingDialog
        open={newMeetingOpen}
        onOpenChange={onNewMeetingChange}
        isPending={createMeeting.isPending}
        workspaceId={workspaceId}
        projects={projects}
        defaultProjectId={selectedProjectId}
        onSubmit={async (title, projectId) => {
          // 만들어졌을 때만 닫는다. 대상 프로젝트가 사라졌거나 응답 guard에 걸리면
          // 노트도 라우팅도 없는데 창만 닫혀 사용자가 만들어진 줄 안다.
          const created = await createMeeting.createMeeting(title, projectId);
          if (created) onNewMeetingChange(false);
          return created;
        }}
      />
    </>
  );
}

/**
 * **셸이 연 포털은 전체 화면 면 위에 남는다.** 시트도 다이얼로그도 `z-50`이고, `inert`는
 * 포털 밖 래퍼에 걸려도 포털 안까지 못 간다. 셸은 노트로 이동해도 재마운트되지 않으므로
 * 상태가 저절로 사라지지도 않는다 — 가리는 대신 실제로 닫는다.
 *
 * 모바일 사이드바(전체 화면을 닫고 사이드바를 연 뒤 뒤로가기로 노트에 돌아오면 열린 채로
 * 남았다)가 여기 걸린다. 설정 창은 주소에서 파생돼 따로 닫을 필요가 없고, 상단바의
 * 「새 노트」 창은 그 컴포넌트가 직접 닫는다.
 */
function CloseShellOverlaysOnFullNote({ isFullNote }: { isFullNote: boolean }) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  useEffect(() => {
    if (!isFullNote) return;
    if (isMobile && openMobile) setOpenMobile(false);
  }, [isFullNote, isMobile, openMobile, setOpenMobile]);
  return null;
}

/**
 * 본문 패널. 캔버스를 꽉 채우지 않고 **둥근 흰 패널로 떠 있다** — 위·아래·오른쪽 10px,
 * 사이드바와의 틈도 10px(design.pen `IUax1`: Content `left-242 top-10 w-1188 h-880`,
 * 뷰포트 1440×900 · 사이드바 232).
 *
 * **개인 챗봇은 이 패널을 밀지 않는다.** `fixed`로 위에 떠서 쌓인다(design.pen: agent chat은
 * 전체 틀 위에 얹히는 층). 예전에는 열릴 때 본문 폭을 `calc(100%-456px)`로 줄여 패널이
 * 통째로 밀렸는데, 그러면 챗봇을 여닫을 때마다 뒤의 목록이 리플로우된다 — 층이 아니라
 * 컬럼으로 다룬 것이다.
 */
function ShellMain({
  workspaceId,
  currentLabel,
  activeNoteId,
  isFullNote,
  children,
}: {
  workspaceId: string;
  currentLabel: string;
  activeNoteId?: string;
  /** 노트 전체 화면이 이 셸을 덮고 있는가. 덮인 크롬을 `inert`로 뺀다. */
  isFullNote: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarInset className="flex-1 bg-[var(--el-canvas)]">
      <div
        // 높이는 뷰포트에 못박는다. `h-full`이면 이 컨테이너가 뒤에 깔린 노트 목록 길이를
        // 따라 늘어나고, 그 위에 `absolute`로 앉는 면이 컨테이너를 다 못 덮어 아래로 목록이
        // 비쳤다(노트 목록이 화면보다 길 때 405px 실측 · APP-252).
        //
        // 여백은 이 바깥 상자가 갖고 패널은 그 안을 채운다. 거터는 사방 10px이다 —
        // 왼쪽 10은 사이드바(캔버스에 flush)와 패널 사이의 틈이다.
        className="relative flex h-svh min-w-0 flex-col p-2.5"
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e2">
          <WorkspaceToolbar
            workspaceId={workspaceId}
            currentLabel={currentLabel}
            activeNoteId={activeNoteId}
            covered={isFullNote}
          />
          {children}
        </div>
      </div>
    </SidebarInset>
  );
}
