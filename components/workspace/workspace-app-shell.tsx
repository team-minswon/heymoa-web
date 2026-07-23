"use client";

import { createContext, useContext, useMemo, useState } from "react";
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
import { useGetProjects } from "@/lib/api/generated/projects/projects";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
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
  hideSidebar,
  children,
}: {
  workspaceId: string;
  activeNoteId?: string;
  hideSidebar?: boolean;
  children: React.ReactNode;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("account");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const workspaceQuery = useGetWorkspace(workspaceId);
  const projectsQuery = useGetProjects(workspaceId);
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
          {!hideSidebar && (
            <Sidebar className="overflow-hidden border-r border-[var(--el-hairline)] [&>[data-sidebar=sidebar]]:overflow-hidden [&>[data-sidebar=sidebar]]:bg-[color-mix(in_srgb,var(--el-canvas-soft)_92%,white)]">
              <WorkspaceSidebar
                workspaceId={workspaceId}
                workspace={workspace}
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                onOpenSettings={value.openSettings}
              />
            </Sidebar>
          )}
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
