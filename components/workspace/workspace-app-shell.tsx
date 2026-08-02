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
  /**
   * 회의 화면이 공유 챗봇 레일을 세웠나. 레일은 패널 **밖**에 떠 있으므로(개인 에이전트
   * 레일과 같은 자리) 패널이 그만큼 좁아져야 둘이 겹치지 않는다. 레일을 패널 안에 두면
   * 디자인의 두 판이 한 판으로 붙어 보이고, 본문 폭도 레일만큼 잘못 계산된다.
   */
  setSharedRailOpen: (open: boolean) => void;
};

// 설정은 모달이 아니라 라우트다. 「어디 있나」가 주소에 없으면 공유도 새로고침도 안 된다.
const SETTINGS_SLUG: Record<SettingsSection, string> = {
  account: "account",
  workspace: "general",
  members: "members",
  integrations: "integrations",
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

const NOOP = () => {};

/**
 * 공유 챗봇 레일이 패널 밖 자리를 차지한다고 셸에 알린다.
 *
 * 셸 밖(테스트·시트 단독 렌더)에서는 좁힐 패널 자체가 없으므로 조용히 아무것도 안 한다 —
 * 여기서 던지면 회의 패널이 셸 없이는 못 서는 컴포넌트가 된다.
 */
export function useSharedRailSlot(open: boolean) {
  const setOpen = useContext(WorkspaceShellContext)?.setSharedRailOpen ?? NOOP;
  useEffect(() => {
    setOpen(open);
    return () => setOpen(false);
  }, [open, setOpen]);
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
  const [sharedRailOpen, setSharedRailOpen] = useState(false);
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
          : `/w/${workspaceId}/meetings`
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
      setSharedRailOpen,
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
  // 설정 다이얼로그가 떠 있어도 상단바는 **뒤 화면**을 말한다 — 닫으면 돌아갈 자리다.
  const currentLabel = pathname.endsWith("/inbox")
    ? "받은 알림"
    : isActionItems
      ? "액션 아이템"
      : (projects.find(
        (project) =>
          project.projectId === (routeProjectId ?? selectedProjectId)
      )?.name ?? "모든 회의");

  // full 회의는 셸을 걷는다 — 회의 화면이 캔버스를 통째로 쓰고 자기 상단바를 갖는다(design.pen).
  // 사이드바를 남기면 본문이 232 좁아져 전사 두 줄이 접히고, 상단바가 둘이 된다.
  const isFullNote =
    Boolean(activeNoteId) && searchParams.get("view") !== "side";

  return (
    <WorkspaceShellContext.Provider value={value}>
      <PersonalChatProvider
        workspaceId={workspaceId}
        workspaceName={workspace?.name}
      >
        <TooltipProvider>
          {/* 셸은 캔버스(#f5f5f5) 위에 사이드바 232 + 흰 패널이 떠 있는 구조다(design.pen).
              사이드바는 배경이 없다 — 캔버스가 그대로 비쳐야 패널이 「떠 있는」 것으로 읽힌다. */}
          <SidebarProvider
            className="min-h-svh bg-[var(--el-canvas)]"
            style={{ "--sidebar-width": "232px" } as React.CSSProperties}
          >
            {/* 설정은 앱 **위에** 다이얼로그로 뜬다 — 사이드바를 갈아끼우지 않는다(design.pen `LS24B`).
                full 회의는 아예 안 그린다 — `hidden` 으로 감추면 자리 확보용 gap 요소가 남아
                232 만큼 빈 칸이 생긴다. */}
            {isFullNote ? null : (
              // 사이드바는 캔버스 위에 얹힌다 — 경계선은 떠 있는 패널만 갖는다.
              <Sidebar className="border-r-0 [&>[data-sidebar=sidebar]]:overflow-hidden [&>[data-sidebar=sidebar]]:bg-transparent">
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
              </Sidebar>
            )}
            <ShellMain
              workspaceId={workspaceId}
              currentLabel={currentLabel}
              activeNoteId={activeNoteId}
              // full 회의만 상단바가 없다 — 회의 머리가 그 자리를 겸한다(design.pen).
              // 설정은 다이얼로그라 뒤 상단바가 그대로 살아 있어야 「앱 위에 떴다」로 읽힌다.
              showToolbar={!isFullNote}
              railOpen={sharedRailOpen}
              // 레일이 본문을 미는가. **노트 full 에서만 민다.**
              // 워크스페이스 목록에서는 레일이 본문 **위에 쌓인다** — design.pen 의
              // `?panel=assistant` 5장이 본문을 1188 그대로 두고 레일을 얹는다. 목록을
              // 좁히면 표의 열이 다시 조판돼 「일시」가 잘린다.
              narrowsForRail={isFullNote}
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
 * 우측 레일(개인 에이전트·공유 챗)은 `fixed`라 본문을 덮는다. 밀지 말지는 표면마다 다르다 —
 * 목록에서는 얹히고, 노트 full 에서는 본문을 밀어 10px 틈을 남긴다. `narrowsForRail` 참조.
 */
function ShellMain({
  workspaceId,
  currentLabel,
  activeNoteId,
  showToolbar,
  railOpen,
  narrowsForRail,
  children,
}: {
  workspaceId: string;
  currentLabel: string;
  activeNoteId?: string;
  showToolbar: boolean;
  railOpen: boolean;
  narrowsForRail: boolean;
  children: React.ReactNode;
}) {
  const { isVisible } = usePersonalChat();
  // 두 레일은 같은 자리를 쓴다 — 동시에 서지 않으므로 한 번만 좁힌다.
  const railTakesSpace = narrowsForRail && (isVisible || railOpen);
  return (
    <SidebarInset className="flex-1 bg-[var(--el-canvas)]">
      <div
        className={cn(
          // 흰 패널. 캔버스에서 10px 띄우고 radius 16 + hairline + e2 그림자로 부양시킨다.
          // 높이는 뷰포트에 못박는다 — `h-full`이면 뒤에 깔린 목록 길이를 따라 늘어나고,
          // 그 위에 `absolute`로 앉는 노트 full 면이 패널을 다 못 덮는다(APP-252).
          "relative m-2.5 flex h-[calc(100svh-20px)] min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-card shadow-e2 transition-[width] duration-200",
          // padding이 아니라 폭을 줄인다 — 노트 full 화면은 이 컨테이너 안에서 `absolute
          // inset-x-0`으로 깔리는데, 절대 배치의 기준은 padding box라 padding으로는 안 밀린다.
          // 좁은 화면에서는 패널이 전체를 덮으므로 본문을 더 줄이지 않는다.
          //
          // 470 = 패널 좌여백 10 + 패널 우여백 10 + 레일 440 + 레일 우여백 10.
          // **490이었고 패널 자기 여백 20을 빠뜨려 레일이 패널을 10px 덮었다** — 패널의
          // 오른쪽 hairline과 radius 16이 레일 밑에 깔리고 표의 마지막 열이 잘렸다.
          // 레일 폭을 바꾸면 여기도 같이 바꾼다. 셋(레일 둘 + 이 값)이 한 세트다.
          railTakesSpace && "lg:w-[calc(100%-470px)]"
        )}
      >
        {showToolbar ? (
          <WorkspaceToolbar
            workspaceId={workspaceId}
            currentLabel={currentLabel}
            activeNoteId={activeNoteId}
          />
        ) : null}
        {children}
      </div>
    </SidebarInset>
  );
}
