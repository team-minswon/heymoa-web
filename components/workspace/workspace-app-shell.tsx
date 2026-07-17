"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
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
          <SidebarInset className="flex-1 bg-[var(--el-canvas)]">
            <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
              <WorkspaceToolbar
                workspaceId={workspaceId}
                currentLabel={currentLabel}
                activeNoteId={activeNoteId}
              />
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </WorkspaceShellContext.Provider>
  );
}
