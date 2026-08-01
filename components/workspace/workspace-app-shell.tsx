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
import type { SettingsSection } from "@/components/settings/settings-dialog";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
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

// 설정은 모달이 아니라 라우트다. 「어디 있나」가 주소에 없으면 공유도 새로고침도 안 된다.
const SETTINGS_SLUG: Record<SettingsSection, string> = {
  account: "account",
  workspace: "general",
  members: "members",
  integrations: "integrations",
};

const SETTINGS_LABEL: Record<string, string> = {
  general: "일반",
  members: "멤버",
  projects: "프로젝트",
  integrations: "연동",
  account: "내 계정",
  notifications: "알림",
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 프로젝트를 고르면 목록으로 돌아간다. 노트 표면이 본문 컬럼을 덮고 있어서(full은 항상,
  // side는 모바일에서 inset-0) 필터만 바꾸면 화면에 아무 일도 안 일어난 것처럼 보인다.
  // 워크스페이스 전환이 이미 이동으로 처리되므로 프로젝트 선택도 같은 성질로 맞춘다.
  // 프로젝트는 URL 을 갖는다. 사이드바 지역 상태로만 두면 「이 프로젝트 보고 있어」를
  // 공유할 수 없고, 새로고침에 선택이 날아간다 — [ROUTES] 가 AS-IS 의 결함으로 적어 둔 것이다.
  // selectedProjectId 는 사이드바 강조와 「새 회의」의 목적지로 계속 쓴다.
  const handleSelectProject = useCallback(
    (projectId: string | null) => {
      setSelectedProjectId(projectId);
      router.push(
        projectId
          ? `/w/${workspaceId}/projects/${projectId}`
          : `/w/${workspaceId}`
      );
    },
    [router, workspaceId]
  );

  // OAuth 연동 승인 후 서버가 /w/{workspaceId}?provider=&status=로 돌려보낸다(APP-194).
  // 연동 설정 모달을 열어 결과를 보이고, 새로고침·뒤로가기에 재실행되지 않게 쿼리를 지운다.
  useEffect(() => {
    const provider = searchParams.get("provider");
    if (!provider) return;
    const status = searchParams.get("status");
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
    // 결과를 연동 설정 화면에서 보여준다. replace 라 뒤로가기에 재실행되지 않는다.
    router.replace(
      `/w/${workspaceId}/settings/integrations${query ? `?${query}` : ""}`,
      { scroll: false }
    );
  }, [searchParams, router, workspaceId]);

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
        router.push(`/w/${workspaceId}/settings/${SETTINGS_SLUG[section]}`);
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
      router,
      selectedProjectId,
      workspace,
      workspaceId,
      workspaceQuery.isPending,
      workspaceQuery.isError,
    ]
  );
  // 브레드크럼은 지금 보고 있는 것을 말해야 한다. 액션 아이템 위에서 「모든 노트」가
  // 떠 있으면 사용자는 자기가 어디 있는지 잘못 안다.
  const isActionItems = pathname.endsWith("/action-items");
  const routeProjectId = pathname.match(/\/projects\/([^/]+)/)?.[1];
  const settingsSlug = pathname.match(/\/settings\/([^/?]+)/)?.[1];
  const currentLabel = settingsSlug
    ? `설정 · ${SETTINGS_LABEL[settingsSlug] ?? settingsSlug}`
    : pathname.endsWith("/inbox")
      ? "받은 알림"
      : isActionItems
        ? "액션 아이템"
    : (projects.find(
        (project) =>
          project.projectId === (routeProjectId ?? selectedProjectId)
      )?.name ?? "모든 노트");

  return (
    <WorkspaceShellContext.Provider value={value}>
      <PersonalChatProvider
        workspaceId={workspaceId}
        workspaceName={workspace?.name}
      >
        <TooltipProvider>
          <SidebarProvider className="bg-[var(--el-canvas)]">
            {/* 설정은 같은 232 슬롯에서 사이드바만 갈아끼운다. 콘텐츠 팬은 안 움직인다. */}
            <Sidebar className="overflow-hidden border-r border-[var(--el-hairline)] [&>[data-sidebar=sidebar]]:overflow-hidden [&>[data-sidebar=sidebar]]:bg-[color-mix(in_srgb,var(--el-canvas-soft)_92%,white)]">
              {settingsSlug ? (
                <SettingsSidebar
                  workspaceId={workspaceId}
                  workspaceName={workspace?.name}
                  section={settingsSlug}
                />
              ) : (
                <WorkspaceSidebar
                  workspaceId={workspaceId}
                  workspace={workspace}
                  projects={projects}
                  // 주소로 바로 들어와도 사이드바가 어디인지 말해야 한다. 라우트가 있으면
                  // 그것이 먼저다 — effect 로 state 를 맞추면 첫 렌더가 한 번 비어 깜빡인다.
                  selectedProjectId={routeProjectId ?? selectedProjectId}
                  onSelectProject={handleSelectProject}
                  onOpenSettings={value.openSettings}
                />
              )}
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
          // 높이는 뷰포트에 못박는다. `h-full`이면 이 컨테이너가 뒤에 깔린 노트 목록 길이를
          // 따라 늘어나고, 그 위에 `absolute`로 앉는 노트 full 면이 컨테이너를 다 못 덮어
          // 아래로 목록이 비쳤다(노트 목록이 화면보다 길 때 405px 실측 · APP-252).
          "relative flex h-svh min-w-0 flex-col overflow-hidden transition-[width] duration-200",
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
