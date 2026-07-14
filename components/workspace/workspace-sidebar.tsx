"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AudioLines,
  Check,
  ChevronUp,
  Folder,
  FolderPlus,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Plus,
  Settings,
  LogOut,
  Trash2,
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
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
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
      await createProject.mutateAsync({ workspaceId, data: { name, description: null } });
    } else {
      await updateProject.mutateAsync({
        workspaceId,
        projectId: projectDialog.project.projectId,
        data: { name, description: null },
      });
    }
    await refreshProjects();
    setProjectDialog(null);
  };

  const initials = user?.name?.trim().slice(0, 1) || "H";

  return (
    <>
      <SidebarHeader className="gap-3 border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <AudioLines className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              HeyMoa
            </p>
            <p className="truncate text-sm font-medium">
              {workspace?.name ?? "워크스페이스"}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                aria-label="워크스페이스 전환"
                className="h-auto w-full justify-between rounded-xl px-3 py-2"
              />
            }
          >
            <span className="truncate">
              {workspace?.name ?? "워크스페이스"}
            </span>
            <ChevronUp className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {workspaces.map((item) => (
              <DropdownMenuItem
                key={item.workspaceId}
                onClick={() => router.push(`/w/${item.workspaceId}`)}
              >
                <span className="flex-1 truncate">{item.name}</span>
                {item.isDefault && (
                  <>
                    <span className="text-xs text-muted-foreground">기본</span>
                    <Check />
                  </>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setWorkspaceDialogOpen(true)}>
              <Plus />새 워크스페이스
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenSettings("workspace")}>
              <Settings />
              워크스페이스 설정
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="워크스페이스">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={selectedProjectId === null}
                    onClick={() => onSelectProject(null)}
                  >
                    <NotebookText />
                    <span>모든 노트</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>프로젝트</SidebarGroupLabel>
            <SidebarGroupAction
              aria-label="새 프로젝트"
              onClick={() => setProjectDialog({ mode: "create" })}
            >
              <FolderPlus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.map((project) => (
                  <SidebarMenuItem key={project.projectId}>
                    <SidebarMenuButton
                      isActive={selectedProjectId === project.projectId}
                      onClick={() => onSelectProject(project.projectId)}
                    >
                      <Folder />
                      <span>{project.name}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <SidebarMenuAction
                            aria-label={`${project.name} 프로젝트 메뉴`}
                            showOnHover
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onClick={() =>
                            setProjectDialog({ mode: "rename", project })
                          }
                        >
                          <Pencil /> 이름 변경
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(project)}
                        >
                          <Trash2 /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-auto w-full justify-start p-2"
              />
            }
          >
            <Avatar className="size-8">
              <AvatarImage src={user?.image ?? undefined} alt="" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">
                {user?.name ?? "사용자"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.email ?? ""}
              </span>
            </span>
            <ChevronUp className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuItem onClick={() => onOpenSettings("account")}>
              <Settings />내 계정 설정
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void logout()}>
              <LogOut />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

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
        <DialogContent
          aria-label={
            projectDialog?.mode === "rename"
              ? "프로젝트 이름 변경"
              : "새 프로젝트 만들기"
          }
        >
          <form action={(formData) => void handleProjectSubmit(formData)}>
            <DialogHeader>
              <DialogTitle>
                {projectDialog?.mode === "rename"
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
                  projectDialog?.mode === "rename"
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
