"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioLines,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Folder,
  Inbox,
  ListChecks,
  Loader2,
  LogOut,
  MoreHorizontal,
  House,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { useRecording } from "@/components/transcription/recording-provider";
import { NavGroupLabel, NavRow } from "@/components/workspace/nav-row";
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
import { useGetActionItems } from "@/lib/api/generated/action-items/action-items";
import { useGetNotifications } from "@/lib/api/generated/notifications/notifications";
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
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import {
  getGetWorkspacesQueryKey,
  useCreateWorkspace,
  useGetWorkspaces,
} from "@/lib/api/generated/workspaces/workspaces";
import { isOverdue } from "@/lib/workspace/action-item-groups";
import { usePinnedNow } from "@/lib/workspace/use-pinned-now";

type ProjectDialogState =
  | { mode: "create" }
  | { mode: "rename"; project: ProjectResponseData }
  | null;

/** 빨간 카운트 배지 — 0이면 안 그린다. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="shrink-0 rounded-full bg-[var(--el-error)] px-1.5 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

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
  const pathname = usePathname();
  const isActionItems = pathname.endsWith("/action-items");
  const isInbox = pathname.endsWith("/inbox");
  const isMeetings = !isActionItems && !isInbox && !selectedProjectId;
  const queryClient = useQueryClient();
  const { user, isLoggingOut, logout } = useAuth();
  const recording = useRecording();
  const nowMs = usePinnedNow();
  const workspacesQuery = useGetWorkspaces();
  const membersQuery = useGetWorkspaceMembers(workspaceId);
  const notificationsQuery = useGetNotifications();
  const actionItemsQuery = useGetActionItems(workspaceId, { status: "OPEN" });
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

  const workspaces =
    workspacesQuery.data?.status === 200 && workspacesQuery.data.data.success
      ? workspacesQuery.data.data.data.workspaces
      : [];
  const memberCount =
    membersQuery.data?.status === 200 && membersQuery.data.data.success
      ? (membersQuery.data.data.data.members?.length ?? 0)
      : 0;
  const unreadCount =
    notificationsQuery.data?.status === 200 &&
    notificationsQuery.data.data.success
      ? notificationsQuery.data.data.data.unreadCount
      : 0;
  // 빨간 배지는 「늦었다」는 뜻이다. 미완료 전체를 담으면 평상시에도 빨간 점이 떠 있어
  // 아무 신호도 되지 않는다 — 기한이 지난 것만 센다.
  const overdueCount =
    nowMs !== null &&
    actionItemsQuery.data?.status === 200 &&
    actionItemsQuery.data.data.success
      ? (actionItemsQuery.data.data.data.actionItems ?? []).filter((item) =>
          isOverdue(item.dueAt, nowMs)
        ).length
      : 0;

  const liveNoteId = recording.activeNoteId ?? recording.session?.noteId;
  const isLive = ["connecting", "recording", "stopping"].includes(
    recording.phase
  );

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
    // 캔버스에서 위아래 10 띄운다 — 패널과 같은 높이에서 시작해야 한 판으로 읽힌다.
    <div className="flex h-full flex-col py-2.5">
      {/* ── 워크스페이스 (h60) ── */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="워크스페이스 전환"
              className="flex h-[60px] w-full shrink-0 items-center gap-2.5 border-b border-[var(--el-hairline)] px-3.5 text-left"
            />
          }
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-[var(--el-primary)]">
            <AudioLines className="size-4 text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[var(--el-ink)]">
              {workspace?.name ?? "워크스페이스"}
            </span>
            <span className="block text-[10px] text-[var(--el-muted)]">
              {memberCount > 0 ? `멤버 ${memberCount}명` : " "}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-[var(--el-muted)]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {workspaces.map((item) => (
            <DropdownMenuItem
              key={item.workspaceId}
              onClick={() => router.push(`/w/${item.workspaceId}/meetings`)}
              className="justify-between rounded-control py-2 text-sm"
            >
              <span className="flex-1 truncate">{item.name}</span>
              {item.workspaceId === workspaceId && (
                <Check className="size-3.5 shrink-0 text-[var(--el-primary)]" />
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ── 상시 목적지 ── */}
        <nav
          aria-label="워크스페이스"
          className="flex flex-col gap-0.5 px-2.5 py-3"
        >
          <NavRow
            icon={House}
            label="모든 회의"
            active={isMeetings}
            onClick={() => onSelectProject(null)}
          />
          <NavRow
            icon={ListChecks}
            label="액션 아이템"
            active={isActionItems}
            onClick={() => router.push(`/w/${workspaceId}/action-items`)}
            trailing={<CountBadge count={overdueCount} />}
          />
          <NavRow
            icon={Inbox}
            label="받은 알림"
            active={isInbox}
            onClick={() => router.push(`/w/${workspaceId}/inbox`)}
            trailing={<CountBadge count={unreadCount} />}
          />
          {isLive && liveNoteId ? (
            <NavRow
              tone="live"
              label="기록 중 1건"
              aria-label="기록 중인 회의로 이동"
              onClick={() =>
                router.push(
                  `/w/${workspaceId}/meetings/${liveNoteId}?view=full&tab=transcript`
                )
              }
              leading={
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--el-error)]" />
              }
              trailing={
                <ChevronRight className="size-3.5 shrink-0 text-[var(--el-error-strong)]" />
              }
            />
          ) : null}
        </nav>

        {/* ── 프로젝트 ── */}
        <div className="flex flex-col gap-0.5 px-2.5 pt-1.5 pb-3">
          <NavGroupLabel
            action={
              <button
                type="button"
                aria-label="새 프로젝트"
                onClick={() => setProjectDialog({ mode: "create" })}
                className="flex size-5 items-center justify-center rounded-chip text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)]"
              >
                <Plus className="size-3.5" />
              </button>
            }
          >
            프로젝트
          </NavGroupLabel>
          {projects.map((project) => (
            <div key={project.projectId} className="group/project relative">
              <NavRow
                icon={Folder}
                label={project.name}
                active={selectedProjectId === project.projectId}
                onClick={() => onSelectProject(project.projectId)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`${project.name} 프로젝트 메뉴`}
                      className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-chip text-[var(--el-muted-soft)] opacity-0 transition-opacity group-hover/project:opacity-100 hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:opacity-100 data-open:opacity-100"
                    />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
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
            </div>
          ))}
        </div>
      </div>

      {/* ── 설정 ── */}
      <div className="flex flex-col gap-0.5 px-2.5 pb-2.5">
        <NavRow
          icon={Settings}
          label="설정"
          onClick={() => onOpenSettings("workspace")}
        />
      </div>

      {/* ── 사용자 (h60) ── */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "로그아웃 중" : "계정 메뉴"}
              className="flex h-[60px] w-full shrink-0 items-center gap-2.5 border-t border-[var(--el-hairline)] px-3.5 text-left"
            />
          }
        >
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--el-surface-strong)] text-[11px] font-semibold text-[var(--el-body)]">
            {isLoggingOut ? (
              <Loader2 className="size-4 animate-spin text-[var(--el-muted)]" />
            ) : (
              initials
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-[var(--el-ink)]">
              {isLoggingOut ? "로그아웃 중" : (user?.name ?? "사용자")}
            </span>
            <span className="block truncate text-[10px] text-[var(--el-muted)]">
              {isLoggingOut ? "잠시만 기다려 주세요" : (user?.email ?? "")}
            </span>
          </span>
          <MoreHorizontal className="size-3.5 shrink-0 text-[var(--el-muted)]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
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
                router.push(`/w/${response.data.data.workspaceId}/meetings`);
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
                  회의를 분류할 프로젝트 이름을 입력하세요.
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
                  toast.error("프로젝트에 회의가 있어 삭제할 수 없습니다.");
                }
                setDeleteTarget(null);
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
