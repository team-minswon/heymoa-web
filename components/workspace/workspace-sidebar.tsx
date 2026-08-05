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
  Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/ui/toast";

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
  type getProjectsResponse,
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
  covered = false,
}: {
  workspaceId: string;
  workspace?: WorkspaceResponseData;
  projects: ProjectResponseData[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onOpenSettings: (section: "account" | "workspace") => void;
  /** 노트 전체 화면이 이 사이드바를 덮고 있는가. 열려 있던 창을 닫는 데 쓴다. */
  covered?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoggingOut, logout } = useAuth();
  const workspacesQuery = useGetWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const createProject = useCreateProject({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const updateProject = useUpdateProject({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const deleteProject = useDeleteProject({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const isProjectMutationPending =
    createProject.isPending || updateProject.isPending;
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponseData | null>(
    null
  );
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  // 노트 전체 화면이 사이드바를 덮으면 **여기서 연 창도 같이 닫는다.** 창은 포털(`z-50`)이라
  // `inert`도 덮는 면(`z-30`)도 닿지 않고, 셸이 재마운트되지 않아 저절로 사라지지도 않는다.
  // 모달이라 바깥을 눌러도 안 닫히므로 노트 위에 갇힌 창이 남는다.
  if (covered && (projectDialog || deleteTarget || workspaceDialogOpen)) {
    setProjectDialog(null);
    setDeleteTarget(null);
    setWorkspaceDialogOpen(false);
  }

  const workspaces =
    workspacesQuery.data?.status === 200 && workspacesQuery.data.data.success
      ? workspacesQuery.data.data.data.workspaces
      : [];

  const refreshProjects = () =>
    queryClient.invalidateQueries({
      queryKey: getGetProjectsQueryKey(workspaceId),
    });

  /**
   * 이름 변경 응답을 목록 캐시에 **바로 써 넣는다.** 예전에는 invalidate의 refetch를 기다렸다가
   * 다이얼로그를 닫았는데, 그사이 버튼의 loading은 이미 꺼져 있어서 **아무 일도 안 일어나는
   * 구간**이 생겼다. 그 구간 동안 뒤에 깔린 사이드바는 옛 이름 그대로였고, 다이얼로그가 닫히는
   * 순간에야 이름이 바뀌어 "확인을 눌렀는데 옛 이름이 잠깐 보인다"로 읽혔다.
   *
   * 서버가 갱신된 프로젝트를 응답으로 주므로 왕복을 한 번 더 돌 이유가 없다. 캐시를 먼저
   * 고치면 닫는 순간 이미 새 이름이고, `refreshProjects()`는 다른 필드(updatedAt 등)를
   * 맞추는 뒷정리로만 남는다.
   */
  const applyRenamedProject = (project: ProjectResponseData) => {
    queryClient.setQueryData(
      getGetProjectsQueryKey(workspaceId),
      (previous: getProjectsResponse | undefined) => {
        if (previous?.status !== 200 || !previous.data.success) return previous;
        return {
          ...previous,
          data: {
            ...previous.data,
            data: {
              ...previous.data.data,
              projects: previous.data.data.projects.map((candidate) =>
                candidate.projectId === project.projectId
                  ? { ...candidate, ...project }
                  : candidate
              ),
            },
          },
        };
      }
    );
  };

  const handleProjectSubmit = async (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name || !projectDialog) return;

    try {
      if (projectDialog.mode === "create") {
        await createProject.mutateAsync({
          workspaceId,
          data: { name, description: null },
        });
        // 새 프로젝트는 목록의 어디에 끼는지를 서버 정렬이 정하므로 캐시에 손으로 못 넣는다.
        // 목록이 새로 와야 자리도 맞는다.
        await refreshProjects();
        toast.success("프로젝트가 생성되었습니다.");
      } else {
        const response = await updateProject.mutateAsync({
          workspaceId,
          projectId: projectDialog.project.projectId,
          data: { name, description: projectDialog.project.description },
        });
        if (response.status === 200 && response.data.success) {
          applyRenamedProject(response.data.data);
        }
        toast.success("프로젝트 이름이 변경되었습니다.");
        void refreshProjects();
      }
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
        {/* ── Workspace switcher (single ~56px row) ── */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                aria-label="워크스페이스 전환"
                className="h-14 w-full justify-start gap-0 rounded-none px-3 hover:bg-[var(--el-surface-strong)] focus-visible:ring-0"
              />
            }
          >
            <div className="flex w-full items-center gap-2.5 min-w-0">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-[var(--el-primary)] text-[11px] font-bold text-white uppercase">
                {workspace?.name?.trim().slice(0, 1) || "W"}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[var(--el-ink)]">
                {workspace?.name ?? "워크스페이스"}
              </span>
              <ChevronsUpDown className="size-3.5 text-[var(--el-muted-soft)] shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-64"
          >
            {workspaces.map((item) => (
              <DropdownMenuItem
                key={item.workspaceId}
                onClick={() => router.push(`/w/${item.workspaceId}`)}
                className="justify-between rounded-control py-2 text-sm"
              >
                <span className="truncate flex-1">{item.name}</span>
                {item.workspaceId === workspaceId && (
                  <Check className="size-3.5 text-[var(--el-primary)] shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-[var(--el-hairline)]" />
            <DropdownMenuItem
              onClick={() => setWorkspaceDialogOpen(true)}
              className="gap-2 rounded-control py-2 text-sm"
            >
              <Plus className="size-4 text-[var(--el-muted)]" />
              <span>새 워크스페이스</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenSettings("workspace")}
              className="gap-2 rounded-control py-2 text-sm"
            >
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
                    className="gap-2.5 text-[13px] font-medium rounded-control h-8 px-2.5"
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
                className="flex size-5 items-center justify-center rounded-chip hover:bg-[var(--el-surface-strong)] text-[var(--el-muted)] hover:text-[var(--el-ink)] transition-colors"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {projectsOpen && projects.length === 0 && (
              <SidebarGroupContent>
                {/* 프로젝트가 0개면 이 자리가 통째로 비어서, 만들 수 있다는 것을 알리는 것이
                    머리글 옆 14px `+` 하나뿐이었다. 새 워크스페이스는 항상 이 상태로
                    시작하므로 처음 들어온 사람이 가장 먼저 보는 화면이 그것이었다.
                    프로젝트 행과 같은 무게의 행 하나를 두어 라벨이 있는 입구를 만든다 —
                    다이얼로그는 `+`가 여는 것과 같은 것이다. */}
                <SidebarMenu className="space-y-0">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setProjectDialog({ mode: "create" })}
                      className="h-8 gap-2.5 rounded-control px-2.5 text-[13px] text-[var(--el-muted)]"
                    >
                      <Plus className="size-4 text-[var(--el-muted)]" />
                      <span>프로젝트 만들기</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
                <p className="px-2.5 pt-1 pb-1 text-[11px] leading-relaxed text-[var(--el-muted-soft)]">
                  회의를 주제별로 묶으면 지난 맥락을 찾기 쉬워집니다.
                </p>
              </SidebarGroupContent>
            )}
            {projectsOpen && projects.length > 0 && (
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0">
                  {projects.map((project) => (
                    <SidebarMenuItem key={project.projectId}>
                      <SidebarMenuButton
                        isActive={selectedProjectId === project.projectId}
                        onClick={() => onSelectProject(project.projectId)}
                        className="gap-2.5 text-[13px] font-medium rounded-control h-8 px-2.5"
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
                              className="size-5 rounded-chip text-[var(--el-muted-soft)] hover:text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
                            />
                          }
                        >
                          <MoreHorizontal className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="right"
                          align="start"
                          className="rounded-panel"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              setProjectDialog({ mode: "rename", project })
                            }
                            className="gap-2 rounded-control py-1.5 text-xs"
                          >
                            <Pencil className="size-3.5 text-[var(--el-muted)]" />
                            <span>이름 변경</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(project)}
                            className="gap-2 rounded-control py-1.5 text-xs text-destructive"
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

      {/* ── User profile (footer) ── */}
      <SidebarFooter className="p-0 border-t border-[var(--el-hairline)]">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                disabled={isLoggingOut}
                aria-label={isLoggingOut ? "로그아웃 중" : undefined}
                className="h-auto w-full justify-start gap-0 rounded-none px-3 py-3 hover:bg-[var(--el-surface-strong)] focus-visible:ring-0"
              />
            }
          >
            <div className="flex w-full items-center gap-2.5 min-w-0">
              {isLoggingOut ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--el-surface-strong)]">
                  <Loader2 className="size-4 animate-spin text-[var(--el-muted)]" />
                </span>
              ) : (
                <Avatar className="size-7 shrink-0 rounded-full">
                  <AvatarImage src={user?.image ?? undefined} alt="" />
                  <AvatarFallback className="rounded-full bg-[var(--el-primary)] text-[var(--el-on-primary)] text-[11px] font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="block truncate text-[13px] font-semibold text-[var(--el-ink)] leading-tight">
                  {isLoggingOut ? "로그아웃 중" : (user?.name ?? "사용자")}
                </p>
                <p className="block truncate text-[11px] text-[var(--el-muted)] leading-tight">
                  {isLoggingOut ? "잠시만 기다려 주세요" : (user?.email ?? "")}
                </p>
              </div>
              <Settings className="size-4 text-[var(--el-muted-soft)] shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            className="w-60"
          >
            <DropdownMenuItem
              onClick={() => onOpenSettings("account")}
              className="gap-2 rounded-control py-2 text-sm"
            >
              <Settings className="size-4 text-[var(--el-muted)]" />
              <span>내 계정 설정</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[var(--el-hairline)]" />
            <DropdownMenuItem
              disabled={isLoggingOut}
              onClick={() => void logout()}
              className="gap-2 rounded-control py-2 text-sm text-destructive"
            >
              {isLoggingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              <span>{isLoggingOut ? "로그아웃 중" : "로그아웃"}</span>
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
                  disabled={isProjectMutationPending}
                  onClick={() => setProjectDialog(null)}
                >
                  취소
                </Button>
                <Button type="submit" loading={isProjectMutationPending}>
                  저장
                </Button>
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
            <AlertDialogCancel disabled={deleteProject.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={deleteProject.isPending}
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
