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
import { useListWorkspaceFolders } from "@/lib/api/generated/folder/folder";
import { useGetWorkspace } from "@/lib/api/generated/workspace/workspace";

type WorkspaceShellState = {
  selectedFolderId: string | null;
  setSelectedFolderId: (folderId: string | null) => void;
  openSettings: (section: SettingsSection) => void;
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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("account");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const workspaceQuery = useGetWorkspace(workspaceId);
  const foldersQuery = useListWorkspaceFolders(workspaceId);
  const workspace =
    workspaceQuery.data?.status === 200 && workspaceQuery.data.data.success
      ? workspaceQuery.data.data.data
      : undefined;
  const folders =
    foldersQuery.data?.status === 200 && foldersQuery.data.data.success
      ? (foldersQuery.data.data.data ?? [])
      : [];
  const value = useMemo(
    () => ({
      selectedFolderId,
      setSelectedFolderId,
      openSettings: (section: SettingsSection) => {
        setSettingsSection(section);
        setSettingsOpen(true);
      },
    }),
    [selectedFolderId]
  );
  const currentLabel =
    folders.find((folder) => folder.folderId === selectedFolderId)?.name ??
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
        <SidebarProvider>
          {!hideSidebar && (
            <Sidebar className="overflow-hidden rounded-r-2xl border-r [&>[data-sidebar=sidebar]]:bg-muted/30 [&>[data-sidebar=sidebar]]:overflow-hidden">
              <WorkspaceSidebar
                workspaceId={workspaceId}
                workspace={workspace}
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                onOpenSettings={value.openSettings}
              />
            </Sidebar>
          )}
          <SidebarInset className="flex-1 bg-card">
            <div className="relative flex h-full min-w-0 flex-col">
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
