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
import { toast } from "sonner";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  PersonalChatProvider,
  usePersonalChat,
} from "@/components/chat/personal-chat";
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
import { cn } from "@/lib/utils";

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
          <SidebarProvider className="bg-[var(--el-canvas)]">
            <Sidebar className="overflow-hidden border-r border-[var(--el-hairline)] [&>[data-sidebar=sidebar]]:overflow-hidden [&>[data-sidebar=sidebar]]:bg-[color-mix(in_srgb,var(--el-canvas-soft)_92%,white)]">
              <WorkspaceSidebar
                workspaceId={workspaceId}
                workspace={workspace}
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={handleSelectProject}
                onOpenSettings={value.openSettings}
              />
            </Sidebar>
            <ShellMain
              workspaceId={workspaceId}
              currentLabel={currentLabel}
              activeNoteId={activeNoteId}
            >
              {children}
            </ShellMain>
          </SidebarProvider>
        </TooltipProvider>
      </PersonalChatProvider>
    </WorkspaceShellContext.Provider>
  );
}

/**
 * 개인 챗봇 패널은 `fixed`라 본문을 덮는다. 열려 있는 동안 본문을 패널 폭(448 + 거터 8)만큼
 * 밀어 두 프레임(`LeuWE`·`LCXcj`)의 본문 컬럼 축소를 그대로 낸다.
 */
function ShellMain({
  workspaceId,
  currentLabel,
  activeNoteId,
  children,
}: {
  workspaceId: string;
  currentLabel: string;
  activeNoteId?: string;
  children: React.ReactNode;
}) {
  const { isVisible } = usePersonalChat();
  return (
    <SidebarInset className="flex-1 bg-[var(--el-canvas)]">
      <div
        className={cn(
          "relative flex h-full min-w-0 flex-col overflow-hidden transition-[width] duration-200",
          // padding이 아니라 폭을 줄인다 — 노트 full 화면은 이 컨테이너 안에서 `absolute
          // inset-x-0`으로 깔리는데, 절대 배치의 기준은 padding box라 padding으로는 안 밀린다.
          // 좁은 화면에서는 패널이 전체를 덮으므로 본문을 더 줄이지 않는다.
          isVisible && "lg:w-[calc(100%-456px)]"
        )}
      >
        <WorkspaceToolbar
          workspaceId={workspaceId}
          currentLabel={currentLabel}
          activeNoteId={activeNoteId}
        />
        {children}
      </div>
    </SidebarInset>
  );
}
