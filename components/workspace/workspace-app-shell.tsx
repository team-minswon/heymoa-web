"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { AudioLines } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [language, setLanguage] = useState("ko");
  const workspaceQuery = useGetWorkspace(workspaceId);
  const workspace =
    workspaceQuery.data?.status === 200 && workspaceQuery.data.data.success
      ? workspaceQuery.data.data.data
      : undefined;
  const value = useMemo(
    () => ({
      selectedFolderId,
      setSelectedFolderId,
      language,
      setLanguage,
    }),
    [language, selectedFolderId]
  );

  return (
    <WorkspaceShellContext.Provider value={value}>
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar className="border-r border-border/70">
            <SidebarHeader className="border-b border-border/70 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <AudioLines className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    HeyMoa
                  </p>
                  <p className="truncate text-sm font-medium">
                    {workspace?.name ?? "워크스페이스"}
                  </p>
                </div>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <nav aria-label="워크스페이스" className="p-3" />
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="min-h-svh bg-background">
            <div className="flex min-h-svh min-w-0 flex-1 flex-col">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </WorkspaceShellContext.Provider>
  );
}
