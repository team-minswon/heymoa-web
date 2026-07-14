"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Folder,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Plus,
  Settings,
  LogOut,
  Trash2,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  getGetProjectsQueryKey,
  useCreateProject,
  useDeleteProject,
  useUpdateProject,
} from "@/lib/api/generated/projects/projects";
import type {
  ProjectResponseData,
  WorkspaceResponseData,
} from "@/lib/api/generated/models";
import {
  getGetWorkspacesQueryKey,
  useCreateWorkspace,
  useGetWorkspaces,
} from "@/lib/api/generated/workspaces/workspaces";

type ProjectDialogState =
  | { mode: "create" }
  | { mode: "rename"; project: ProjectResponseData }
  | null;

export function WorkspaceSidebar({
  workspaceId,
  workspace,
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenSettings,
}: {
  workspaceId: string;
  workspace?: WorkspaceResponseData;
  projects: ProjectResponseData[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onOpenSettings: (section: "account" | "workspace") => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const workspacesQuery = useGetWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponseData | null>(null);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);

  const workspaces =
    workspacesQuery.data?.status === 200 && workspacesQuery.data.data.success
      ? workspacesQuery.data.data.data.workspaces
      : [];

  const refreshProjects = () =>
    queryClient.invalidateQueries({
      queryKey: getGetProjectsQueryKey(workspaceId),
    });

  const handleProjectSubmit = async (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name || !projectDialog) return;

    if (projectDialog.mode === "create") {
      await createProject.mutateAsync({
        workspaceId,
        data: { name, description: null },
      });
    } else {
      await updateProject.mutateAsync({
        workspaceId,
        projectId: projectDialog.project.projectId,
        data: { name, description: projectDialog.project.description },
      });
    }
    await refreshProjects();
    setProjectDialog(null);
  };

  const initials = user?.name?.trim().slice(0, 1) || "H";

  return (
    <>
      <SidebarHeader className="gap-2.5 p-4 pb-3">
        {/* User Profile Selector (Top) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-auto w-full justify-between p-1.5 hover:bg-accent/50 focus-visible:ring-0 rounded-xl"
              />
            }
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="size-8 rounded-full border border-sidebar-border/60">
                <AvatarImage src={user?.image ?? undefined} alt="" />
                <AvatarFallback className="rounded-full bg-primary/5 text-primary text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="block truncate text-xs font-semibold text-foreground leading-tight">
                  {user?.name ?? "사용자"}
                </p>
                <p className="block truncate text-[10px] text-muted-foreground leading-tight">
                  {user?.email ?? ""}
                </p>
              </div>
            </div>
            <ChevronsUpDown className="size-3.5 text-muted-foreground/80 shrink-0 ml-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-sidebar-border">
            <DropdownMenuItem onClick={() => onOpenSettings("account")} className="gap-2 rounded-lg py-2">
              <Settings className="size-4" />
              <span>내 계정 설정</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-sidebar-border" />
            <DropdownMenuItem onClick={() => void logout()} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg py-2">
              <LogOut className="size-4" />
              <span>로그아웃</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-px bg-sidebar-border my-1" />

        {/* Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                aria-label="워크스페이스 전환"
                className="h-auto w-full justify-between p-1.5 hover:bg-accent/50 focus-visible:ring-0 rounded-xl"
              />
            }
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#3f3a36] text-[10px] font-bold text-white uppercase">
                {workspace?.name?.trim().slice(0, 1) || "W"}
              </span>
              <span className="truncate text-xs font-semibold text-foreground">
                {workspace?.name ?? "워크스페이스"}
              </span>
            </div>
            <ChevronsUpDown className="size-3.5 text-muted-foreground/80 shrink-0 ml-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-sidebar-border">
            {workspaces.map((item) => (
              <DropdownMenuItem
                key={item.workspaceId}
                onClick={() => router.push(`/w/${item.workspaceId}`)}
                className="justify-between rounded-lg py-2"
              >
                <span className="truncate flex-1">{item.name}</span>
                {item.isDefault && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">기본</span>
                    <Check className="size-3.5 text-primary" />
                  </div>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-sidebar-border" />
            <DropdownMenuItem onClick={() => setWorkspaceDialogOpen(true)} className="gap-2 rounded-lg py-2">
              <Plus className="size-4" />
              <span>새 워크스페이스</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenSettings("workspace")} className="gap-2 rounded-lg py-2">
              <Settings className="size-4" />
              <span>워크스페이스 설정</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <nav aria-label="워크스페이스" className="space-y-1">
          {/* All Notes */}
          <SidebarGroup className="py-1">
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={selectedProjectId === null}
                    onClick={() => onSelectProject(null)}
                    className="gap-2.5 text-xs font-medium rounded-lg h-8 px-2"
                  >
                    <NotebookText className="size-4 opacity-70" />
                    <span>모든 노트</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Collapsible Projects Group */}
          <SidebarGroup className="py-1">
            <div className="flex items-center justify-between px-2 py-1">
              <button
                onClick={() => setProjectsOpen(!projectsOpen)}
                className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground/80 hover:text-foreground uppercase text-left shrink-0"
              >
                {projectsOpen ? (
                  <ChevronDown className="size-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3 text-muted-foreground" />
                )}
                <span>프로젝트</span>
              </button>
              <button
                aria-label="새 프로젝트"
                onClick={() => setProjectDialog({ mode: "create" })}
                className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {projectsOpen && (
              <SidebarGroupContent className="mt-1">
                <SidebarMenu className="space-y-0.5">
                  {projects.map((project) => (
                    <SidebarMenuItem key={project.projectId}>
                      <SidebarMenuButton
                        isActive={selectedProjectId === project.projectId}
                        onClick={() => onSelectProject(project.projectId)}
                        className="gap-2.5 text-xs font-medium rounded-lg h-8 px-2"
                      >
                        <Folder className="size-4 opacity-70" />
                        <span className="truncate">{project.name}</span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <SidebarMenuAction
                              aria-label={`${project.name} 프로젝트 메뉴`}
                              showOnHover
                              className="size-6 text-muted-foreground/60 hover:text-foreground hover:bg-accent"
                            />
                          }
                        >
                          <MoreHorizontal className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" className="rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-sidebar-border">
                          <DropdownMenuItem
                            onClick={() =>
                              setProjectDialog({ mode: "rename", project })
                            }
                            className="gap-2 rounded-lg py-1.5 text-xs"
                          >
                            <Pencil className="size-3.5" />
                            <span>이름 변경</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(project)}
                            className="gap-2 rounded-lg py-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
                          >
                            <Trash2 className="size-3.5" />
                            <span>삭제</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}>
        <DialogContent aria-label="새 워크스페이스 만들기">
          <form
            action={async (formData) => {
              const name = String(formData.get("name") ?? "").trim();
              if (!name) return;
              const response = await createWorkspace.mutateAsync({
                data: { name, description: null },
              });
              if (response.status === 201 && response.data.success) {
                await queryClient.invalidateQueries({
                  queryKey: getGetWorkspacesQueryKey(),
                });
                setWorkspaceDialogOpen(false);
                router.push(`/w/${response.data.data.workspaceId}`);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>새 워크스페이스</DialogTitle>
              <DialogDescription>
                회의 기록을 모을 공간의 이름을 정해 주세요.
              </DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Label htmlFor="new-workspace-name">워크스페이스 이름</Label>
              <Input
                id="new-workspace-name"
                name="name"
                className="mt-2"
                required
                maxLength={80}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWorkspaceDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" loading={createWorkspace.isPending}>
                만들기
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={projectDialog !== null}
        onOpenChange={(open) => !open && setProjectDialog(null)}
      >
        {projectDialog !== null && (
          <DialogContent
            aria-label={
              projectDialog.mode === "rename"
                ? "프로젝트 이름 변경"
                : "새 프로젝트 만들기"
            }
          >
            <form action={(formData) => void handleProjectSubmit(formData)}>
              <DialogHeader>
                <DialogTitle>
                  {projectDialog.mode === "rename"
                    ? "프로젝트 이름 변경"
                    : "새 프로젝트 만들기"}
                </DialogTitle>
                <DialogDescription>
                  노트를 분류할 프로젝트 이름을 입력하세요.
                </DialogDescription>
              </DialogHeader>
              <div className="py-5">
                <Label htmlFor="project-name">프로젝트 이름</Label>
                <Input
                  id="project-name"
                  name="name"
                  className="mt-2"
                  maxLength={50}
                  required
                  autoFocus
                  defaultValue={
                    projectDialog.mode === "rename"
                      ? projectDialog.project.name
                      : ""
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProjectDialog(null)}
                >
                  취소
                </Button>
                <Button type="submit">저장</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} 프로젝트가 삭제됩니다. 프로젝트에 노트가 있으면 삭제할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const response = await deleteProject.mutateAsync({
                    workspaceId,
                    projectId: deleteTarget.projectId,
                  });
                  if (response.status === 204) {
                    if (selectedProjectId === deleteTarget.projectId) {
                      onSelectProject(null);
                    }
                    await refreshProjects();
                  }
                } catch {
                  // Error handled by react-query / global error boundary
                }
                setDeleteTarget(null);
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
