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
import { useTranslations } from "next-intl";
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
  openCreateProject: () => void;
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

export function useOpenSettings() {
  return useContext(WorkspaceShellContext)?.openSettings ?? null;
}

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
  const t = useTranslations("shell.appShell");
  const tNav = useTranslations("shell.nav");

  // **첫 커밋 뒤에만 URL을 읽고 쓴다.** 링크로 바로 들어오면 셸이 첫 hydration과 함께 마운트되는데,
  // 그때 자식 effect는 App Router가 `history.replaceState`를 패치하기 전에 돈다 — 네이티브
  // 호출이 되어 현재 엔트리의 라우터 상태를 지우고 `useSearchParams`도 안 바뀐다
  // 서버는 쿼리를 알아도 창은 클라이언트에서만 열린다.
  const [committed, setCommitted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 첫 커밋을 표시하는 것 자체가 목적이다
  useEffect(() => setCommitted(true), []);

  const settingsParam = searchParams.get(SETTINGS_PARAM);
  const urlSection =
    settingsParam === null
      ? null
      : (parseSettingsSection(settingsParam) ?? DEFAULT_SETTINGS_SECTION);
  const settingsOpen = committed && urlSection !== null;
  const [shownSection, setShownSection] = useState<SettingsSection>(
    DEFAULT_SETTINGS_SECTION
  );
  if (urlSection !== null && urlSection !== shownSection) {
    setShownSection(urlSection);
  }
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

  useEffect(() => {
    if (!committed) return;
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    if (!provider) return;
    const status = params.get("status");
    if (status === "connected") {
      track("integration_connected", { provider });
      toast.success(
        t("integrationConnected", {
          provider: INTEGRATION_LABEL[provider] ?? provider,
        })
      );
    } else {
      toast.error(t("integrationFailed"));
    }
    pushedRef.current = false;
    replaceSettings("integrations", ["provider", "status"]);
  }, [committed, searchParams, t]);

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
  const onboarding = useOnboardingChecklist({
    workspaceId,
    isWorkspacePending: workspaceQuery.isPending || projectsQuery.isPending,
  });
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

  const newMeetingProjectId = searchParams.get("newMeeting");
  useEffect(() => {
    if (!committed || !newMeetingProjectId) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (projects.some((project) => project.projectId === newMeetingProjectId)) {
      setSelectedProjectId(newMeetingProjectId);
      setNewMeetingOpen(true);
    } else {
      toast.error(t("meetingProjectNotFound"));
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
  }, [committed, newMeetingProjectId, projects, searchParams, pathname, t]);

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
      ? tNav("tasks")
      : pathname.startsWith(`/w/${workspaceId}/projects/`)
        ? tNav("connectionMap")
        : (projects.find((project) => project.projectId === selectedProjectId)
            ?.name ?? tNav("allNotes"));
  const isFullNote =
    Boolean(activeNoteId) && searchParams.get("view") !== "side";
  // 전체 화면이 셸을 덮으면 **셸이 연 창도 같이 닫는다.** 창은 포털(`z-50`)이라 `inert`도
  // 덮는 면(`z-30`)도 닿지 않고, 셸이 재마운트되지 않아 저절로 사라지지도 않는다.
  if (isFullNote && (createProject || newMeetingOpen)) {
    setCreateProject(null);
    setNewMeetingOpen(false);
  }

  return (
    <WorkspaceShellContext.Provider value={value}>
      <PersonalChatProvider workspaceId={workspaceId}>
        <TooltipProvider>
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
            <SidebarProvider className="bg-[var(--el-canvas)]">
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
 */
function CloseShellOverlaysOnFullNote({ isFullNote }: { isFullNote: boolean }) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  useEffect(() => {
    if (!isFullNote) return;
    if (isMobile && openMobile) setOpenMobile(false);
  }, [isFullNote, isMobile, openMobile, setOpenMobile]);
  return null;
}

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
  isFullNote: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarInset className="flex-1 bg-[var(--el-canvas)]">
      <div className="relative flex h-svh min-w-0 flex-col p-2.5">
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
