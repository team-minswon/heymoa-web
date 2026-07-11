"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { useListWorkspaceFolders } from "@/lib/api/generated/folder/folder";
import { useGetWorkspace } from "@/lib/api/generated/workspace/workspace";

type WorkspaceShellState = {
  selectedFolderId: string | null;
  setSelectedFolderId: (folderId: string | null) => void;
  language: string;
  setLanguage: (language: string) => void;
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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [language, setLanguage] = useState("ko");
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
      language,
      setLanguage,
    }),
    [language, selectedFolderId]
  );
  const currentLabel =
    folders.find((folder) => folder.folderId === selectedFolderId)?.name ??
    "모든 노트";

  return (
    <WorkspaceShellContext.Provider value={value}>
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar className="border-r border-border/70">
            <WorkspaceSidebar
              workspaceId={workspaceId}
              workspace={workspace}
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
            />
          </Sidebar>
          <SidebarInset className="min-h-svh bg-background">
            <div className="flex min-h-svh min-w-0 flex-1 flex-col">
              <WorkspaceToolbar
                workspaceId={workspaceId}
                currentLabel={currentLabel}
                language={language}
                onLanguageChange={setLanguage}
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
