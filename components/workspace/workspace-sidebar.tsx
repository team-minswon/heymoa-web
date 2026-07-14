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
import { toast } from "sonner";

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

    try {
      if (projectDialog.mode === "create") {
        await createProject.mutateAsync({
          workspaceId,
          data: { name, description: null },
        });
        toast.success("프로젝트가 생성되었습니다.");
      } else {
        await updateProject.mutateAsync({
          workspaceId,
          projectId: projectDialog.project.projectId,
          data: { name, description: projectDialog.project.description },
        });
        toast.success("프로젝트 이름이 변경되었습니다.");
      }
      await refreshProjects();
    } catch {
      if (projectDialog.mode === "create") {
        toast.error("프로젝트 생성에 실패했습니다.");
      } else {
        toast.error("프로젝트 이름 변경에 실패했습니다.");
      }
    }
    setProjectDialog(null);
  };

  const initials = user?.name?.trim().slice(0, 1) || "H";

  return (
    <>
      <SidebarHeader className="p-0">
        {/* ── User profile ── */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-0 rounded-none px-3 py-3 hover:bg-[var(--el-surface-strong)] focus-visible:ring-0"
              />
            }
          >
            <div className="flex w-full items-center gap-2.5 min-w-0">
              <Avatar className="size-7 shrink-0 rounded-full">
                <AvatarImage src={user?.image ?? undefined} alt="" />
                <AvatarFallback className="rounded-full bg-[var(--el-primary)] text-[var(--el-on-primary)] text-[11px] font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="block truncate text-[13px] font-semibold text-[var(--el-ink)] leading-tight">
                  {user?.name ?? "사용자"}
                </p>
                <p className="block truncate text-[11px] text-[var(--el-muted)] leading-tight">
                  {user?.email ?? ""}
                </p>
              </div>
              <ChevronsUpDown className="size-3.5 text-[var(--el-muted-soft)] shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[var(--el-hairline)]">
            <DropdownMenuItem onClick={() => onOpenSettings("account")} className="gap-2 rounded-lg py-2 text-sm">
              <Settings className="size-4 text-[var(--el-muted)]" />
              <span>내 계정 설정</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[var(--el-hairline)]" />
            <DropdownMenuItem onClick={() => void logout()} className="gap-2 text-destructive rounded-lg py-2 text-sm">
              <LogOut className="size-4" />
              <span>로그아웃</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-px bg-[var(--el-hairline)]" />

        {/* ── Workspace switcher ── */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                aria-label="워크스페이스 전환"
                className="h-auto w-full justify-start gap-0 rounded-none px-3 py-2.5 hover:bg-[var(--el-surface-strong)] focus-visible:ring-0"
              />
            }
          >
            <div className="flex w-full items-center gap-2.5 min-w-0">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--el-primary)] text-[9px] font-bold text-white uppercase">
                {workspace?.name?.trim().slice(0, 1) || "W"}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-[var(--el-body-strong)]">
                {workspace?.name ?? "워크스페이스"}
              </span>
              <ChevronsUpDown className="size-3.5 text-[var(--el-muted-soft)] shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[var(--el-hairline)]">
            {workspaces.map((item) => (
              <DropdownMenuItem
                key={item.workspaceId}
                onClick={() => router.push(`/w/${item.workspaceId}`)}
                className="justify-between rounded-lg py-2 text-sm"
              >
                <span className="truncate flex-1">{item.name}</span>
                {item.workspaceId === workspaceId && (
                  <Check className="size-3.5 text-[var(--el-primary)] shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-[var(--el-hairline)]" />
            <DropdownMenuItem onClick={() => setWorkspaceDialogOpen(true)} className="gap-2 rounded-lg py-2 text-sm">
              <Plus className="size-4 text-[var(--el-muted)]" />
              <span>새 워크스페이스</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenSettings("workspace")} className="gap-2 rounded-lg py-2 text-sm">
              <Settings className="size-4 text-[var(--el-muted)]" />
              <span>워크스페이스 설정</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-px bg-[var(--el-hairline)]" />
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2">
        <nav aria-label="워크스페이스">
          {/* ── 모든 노트 ── */}
          <SidebarGroup className="py-0.5">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={selectedProjectId === null}
                    onClick={() => onSelectProject(null)}
                    className="gap-2.5 text-[13px] font-medium rounded-lg h-8 px-2.5"
                  >
                    <NotebookText className="size-4 text-[var(--el-muted)]" />
                    <span>모든 노트</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* ── 프로젝트 ── */}
          <SidebarGroup className="py-0.5 mt-2">
            <div className="flex items-center justify-between px-2 py-1">
              <button
                onClick={() => setProjectsOpen(!projectsOpen)}
                className="flex items-center gap-1 text-[11px] font-semibold tracking-widest text-[var(--el-muted)] hover:text-[var(--el-ink)] uppercase transition-colors"
              >
                {projectsOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                프로젝트
              </button>
              <button
                aria-label="새 프로젝트"
                onClick={() => setProjectDialog({ mode: "create" })}
                className="flex size-5 items-center justify-center rounded hover:bg-[var(--el-surface-strong)] text-[var(--el-muted)] hover:text-[var(--el-ink)] transition-colors"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {projectsOpen && (
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0">
                  {projects.map((project) => (
                    <SidebarMenuItem key={project.projectId}>
                      <SidebarMenuButton
                        isActive={selectedProjectId === project.projectId}
                        onClick={() => onSelectProject(project.projectId)}
                        className="gap-2.5 text-[13px] font-medium rounded-lg h-8 px-2.5"
                      >
                        <Folder className="size-4 text-[var(--el-muted)]" />
                        <span className="truncate">{project.name}</span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <SidebarMenuAction
                              aria-label={`${project.name} 프로젝트 메뉴`}
                              showOnHover
                              className="size-5 rounded text-[var(--el-muted-soft)] hover:text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
                            />
                          }
                        >
                          <MoreHorizontal className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" className="rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[var(--el-hairline)]">
                          <DropdownMenuItem
                            onClick={() =>
                              setProjectDialog({ mode: "rename", project })
                            }
                            className="gap-2 rounded-lg py-1.5 text-xs"
                          >
                            <Pencil className="size-3.5 text-[var(--el-muted)]" />
                            <span>이름 변경</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(project)}
                            className="gap-2 rounded-lg py-1.5 text-xs text-destructive"
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
              {deleteTarget?.name} 프로젝트가 삭제됩니다.
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
                    toast.success("프로젝트가 삭제되었습니다.");
                  } else {
                    toast.error("프로젝트 삭제에 실패했습니다.");
                  }
                } catch {
                  toast.error("프로젝트에 노트가 있어 삭제할 수 없습니다.");
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
