"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/ui/toast";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersonalChatProvider } from "@/components/chat/personal-chat";
import {
  SettingsDialog,
  type SettingsSection,
} from "@/components/settings/settings-dialog";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
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
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("account");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 프로젝트를 고르면 목록으로 돌아간다. 노트 표면이 본문 컬럼을 덮고 있어서(full은 항상,
  // side는 모바일에서 inset-0) 필터만 바꾸면 화면에 아무 일도 안 일어난 것처럼 보인다.
  // 워크스페이스 전환이 이미 이동으로 처리되므로 프로젝트 선택도 같은 성질로 맞춘다.
  const handleSelectProject = useCallback(
    (projectId: string | null) => {
      setSelectedProjectId(projectId);

      if (activeNoteId) {
        router.push(`/w/${workspaceId}`);
      }
    },
    [activeNoteId, router, workspaceId]
  );

  // OAuth 연동 승인 후 서버가 /w/{workspaceId}?provider=&status=로 돌려보낸다(APP-194).
  // 연동 설정 모달을 열어 결과를 보이고, 새로고침·뒤로가기에 재실행되지 않게 쿼리를 지운다.
  useEffect(() => {
    const provider = searchParams.get("provider");
    if (!provider) return;
    const status = searchParams.get("status");
    // URL 쿼리(외부 상태)에 반응해 설정 모달을 여는 정당한 동기화 — toast·replace와 한 묶음이라 effect가 맞다.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSettingsSection("integrations");
    setSettingsOpen(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (status === "connected") {
      toast.success(
        `${INTEGRATION_LABEL[provider] ?? provider} 연동을 연결했습니다.`
      );
    } else {
      toast.error("연동 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("provider");
    next.delete("status");
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // suspense — 로딩/에러는 route-layout의 DataBoundary가 잡는다. isPending/isError는 항상 false라
  // context 인터페이스(workspace-page가 소비)는 그대로 두어도 값이 자연히 false가 된다.
  // 참조가 매 렌더 바뀌면 아래 effect가 매번 돌아 사용자가 방금 연 창을 닫는다.
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

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
  const value = useMemo(
    () => ({
      selectedProjectId,
      setSelectedProjectId,
      openSettings: (section: SettingsSection) => {
        setSettingsSection(section);
        setSettingsOpen(true);
      },
      workspace,
      projects,
      isWorkspacePending: workspaceQuery.isPending || projectsQuery.isPending,
      isWorkspaceError: workspaceQuery.isError || projectsQuery.isError,
    }),
    [
      projects,
      projectsQuery.isPending,
      projectsQuery.isError,
      selectedProjectId,
      workspace,
      workspaceQuery.isPending,
      workspaceQuery.isError,
    ]
  );
  const currentLabel =
    projects.find((project) => project.projectId === selectedProjectId)?.name ??
    "모든 노트";
  // 노트 전체 화면은 이 셸을 통째로 덮는다(design.pen `XtEMZ`). side 시트는 안 덮는다.
  const isFullNote =
    Boolean(activeNoteId) && searchParams.get("view") !== "side";

  return (
    <WorkspaceShellContext.Provider value={value}>
      <PersonalChatProvider
        workspaceId={workspaceId}
        workspaceName={workspace?.name}
      >
        <TooltipProvider>
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            initialSection={settingsSection}
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
                onSelectProject={handleSelectProject}
                onOpenSettings={value.openSettings}
                covered={isFullNote}
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
            <CloseShellOverlaysOnFullNote
              isFullNote={isFullNote}
              closeSettings={closeSettings}
            />
          </SidebarProvider>
        </TooltipProvider>
      </PersonalChatProvider>
    </WorkspaceShellContext.Provider>
  );
}

/**
 * **셸이 연 포털은 전체 화면 면 위에 남는다.** 시트도 다이얼로그도 `z-50`이고, `inert`는
 * 포털 밖 래퍼에 걸려도 포털 안까지 못 간다. 셸은 노트로 이동해도 재마운트되지 않으므로
 * 상태가 저절로 사라지지도 않는다 — 가리는 대신 실제로 닫는다.
 *
 * 모바일 사이드바(전체 화면을 닫고 사이드바를 연 뒤 뒤로가기로 노트에 돌아오면 열린 채로
 * 남았다)와 설정 창이 여기 걸린다. 상단바의 「새 노트」 창은 그 컴포넌트가 직접 닫는다.
 */
function CloseShellOverlaysOnFullNote({
  isFullNote,
  closeSettings,
}: {
  isFullNote: boolean;
  closeSettings: () => void;
}) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  useEffect(() => {
    if (!isFullNote) return;
    if (isMobile && openMobile) setOpenMobile(false);
    closeSettings();
  }, [closeSettings, isFullNote, isMobile, openMobile, setOpenMobile]);
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
