"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Check,
  Folder,
  MoreHorizontal,
  NotebookText,
  Orbit,
  Pencil,
  Plus,
  Settings,
  LogOut,
  Trash2,
  UserRound,
  ChevronsUpDown,
  ChevronDown,
  CircleHelp,
  MessageSquareText,
  ListChecks,
  ListTodo,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "@/lib/ui/toast";

import { useAuth } from "@/components/auth/auth-provider";
import { SidebarUsage } from "@/components/billing/sidebar-usage";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import {
  FeedbackDialog,
  INQUIRY_PARAM,
  UnseenCount,
} from "@/components/workspace/feedback-dialog";
import { hrefWithParam } from "@/lib/workspace/settings-url";
import { useFeedbackAnswers } from "@/components/workspace/use-feedback-answers";
import { useNotificationCenter } from "@/components/notification/notification-center";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import type { SettingsSection } from "@/components/settings/settings-dialog";
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
  useDeleteProject,
  useUpdateProject,
  type getProjectsResponse,
} from "@/lib/api/generated/projects/projects";
import type {
  ProjectResponseData,
  WorkspaceResponseData,
} from "@/lib/api/generated/models";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { sortByLastVisited } from "@/lib/workspaces/last-workspace";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";
import { Collapse } from "@/components/heymoa/collapse";
import { openSitePage } from "@/lib/desktop/open-site-page";
import { updateChecklist } from "@/lib/onboarding/checklist";
import { localePath } from "@/lib/i18n/locales";

type ProjectDialogState = { project: ProjectResponseData } | null;

export function WorkspaceSidebar({
  workspaceId,
  workspace,
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenSettings,
  onCreateProject,
  covered = false,
  onboarding,
}: {
  workspaceId: string;
  workspace?: WorkspaceResponseData;
  projects: ProjectResponseData[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onOpenSettings: (section: SettingsSection) => void;
  onCreateProject: () => void;
  covered?: boolean;
  onboarding?: React.ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations("shell.sidebar");
  const tNav = useTranslations("shell.nav");
  const locale = useLocale();
  const tActions = useTranslations("common.actions");
  const notesHref = `/w/${workspaceId}`;
  const tasksHref = `/w/${workspaceId}/tasks`;
  const pathname = usePathname();
  const onTasks = pathname === tasksHref;
  const projectMapPrefix = `/w/${workspaceId}/projects/`;
  const mapProjectId = pathname.startsWith(projectMapPrefix)
    ? pathname.slice(projectMapPrefix.length)
    : null;
  const onNotes = pathname === notesHref;
  const queryClient = useQueryClient();
  const { user, isLoggingOut, logout } = useAuth();
  const workspacesQuery = useGetWorkspaces();
  const updateProject = useUpdateProject({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const deleteProject = useDeleteProject({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const canDeleteProject = workspace?.role === "ADMIN";
  const isProjectMutationPending = updateProject.isPending;
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponseData | null>(
    null
  );
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const inquiryId = useSearchParams().get(INQUIRY_PARAM);
  const { unseen: feedbackUnseen } = useFeedbackAnswers();
  const notifications = useNotificationCenter();
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

  const handleProjectRename = async (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name || !projectDialog) return;

    try {
      const response = await updateProject.mutateAsync({
        workspaceId,
        projectId: projectDialog.project.projectId,
        data: { name, description: projectDialog.project.description },
      });
      if (response.status === 200 && response.data.success) {
        applyRenamedProject(response.data.data);
      }
      toast.success(t("toast.renamed"));
      void refreshProjects();
    } catch {
      toast.error(t("toast.renameFailed"));
    }
    setProjectDialog(null);
  };

  return (
    <>
      <SidebarHeader className="p-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                aria-label={t("switchWorkspace")}
                className="h-14 w-full justify-start gap-0 rounded-none px-3 hover:bg-[var(--el-surface-strong)] focus-visible:ring-0"
              />
            }
          >
            <div className="flex w-full items-center gap-2.5 min-w-0">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-[var(--el-primary)] text-[11px] font-bold text-white uppercase">
                {workspace?.name?.trim().slice(0, 1) || "W"}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[var(--el-ink)]">
                {workspace?.name ?? t("workspaceFallback")}
              </span>
              <ChevronsUpDown className="size-3.5 text-[var(--el-muted-soft)] shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {sortByLastVisited(workspaces).map((item) => (
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
              <span>{t("newWorkspace")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenSettings("workspace")}
              className="gap-2 rounded-control py-2 text-sm"
            >
              <Settings className="size-4 text-[var(--el-muted)]" />
              <span>{t("workspaceSettings")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-px bg-[var(--el-hairline)]" />
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2">
        <nav aria-label={t("label")}>
          <SidebarGroup className="py-0.5">
            <SidebarGroupContent>
              <SidebarMenu>
                {notifications ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={notifications.openNotifications}
                      className="gap-2.5 text-[13px] font-medium rounded-control h-8 px-2.5"
                    >
                      <NavigationIcon icon={Bell} />
                      <span>{tNav("notifications")}</span>
                      <UnseenCount
                        count={notifications.unreadCount ?? 0}
                        label={(count) => t("unreadNotifications", { count })}
                        className="ml-auto"
                      />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      onNotes ? undefined : (
                        <Link
                          href={notesHref}
                          onNavigate={() => onSelectProject(null)}
                        />
                      )
                    }
                    isActive={
                      selectedProjectId === null && !onTasks && !mapProjectId
                    }
                    onClick={onNotes ? () => onSelectProject(null) : undefined}
                    className="gap-2.5 text-[13px] font-medium rounded-control h-8 px-2.5"
                  >
                    <NavigationIcon icon={NotebookText} />
                    <span>{tNav("allNotes")}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href={tasksHref} />}
                    isActive={onTasks}
                    className="gap-2.5 text-[13px] font-medium rounded-control h-8 px-2.5"
                  >
                    <NavigationIcon icon={ListTodo} />
                    <span>{tNav("tasks")}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="py-0.5 mt-2">
            <div className="flex items-center justify-between px-2 py-1">
              <button
                type="button"
                aria-expanded={projectsOpen}
                onClick={() => setProjectsOpen(!projectsOpen)}
                className="flex items-center gap-1 text-[11px] font-semibold tracking-widest text-[var(--el-muted)] hover:text-[var(--el-ink)] uppercase transition-colors"
              >
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3 transition-transform duration-200 ease-out motion-reduce:transition-none",
                    !projectsOpen && "-rotate-90"
                  )}
                />
                {t("projects")}
              </button>
              <button
                aria-label={t("newProject")}
                onClick={onCreateProject}
                className="flex size-5 items-center justify-center rounded-chip hover:bg-[var(--el-surface-strong)] text-[var(--el-muted)] hover:text-[var(--el-ink)] transition-colors"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <Collapse open={projectsOpen} className="-m-1">
              <div className="p-1">
                {projects.length === 0 && (
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-0">
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={onCreateProject}
                          className="h-8 gap-2.5 rounded-control px-2.5 text-[13px] text-[var(--el-muted)]"
                        >
                          <Plus className="size-4 text-[var(--el-muted)]" />
                          <span>{t("createProject")}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                    <p className="px-2.5 pt-1 pb-1 text-[11px] leading-relaxed text-[var(--el-muted-soft)]">
                      {t("projectsHint")}
                    </p>
                  </SidebarGroupContent>
                )}
                {projects.length > 0 && (
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-0">
                      {projects.map((project) => (
                        <SidebarMenuItem key={project.projectId}>
                          <SidebarMenuButton
                            render={
                              onNotes ? undefined : (
                                <Link
                                  href={notesHref}
                                  onNavigate={() =>
                                    onSelectProject(project.projectId)
                                  }
                                />
                              )
                            }
                            isActive={
                              mapProjectId
                                ? mapProjectId === project.projectId
                                : !onTasks &&
                                  selectedProjectId === project.projectId
                            }
                            onClick={
                              onNotes
                                ? () => onSelectProject(project.projectId)
                                : undefined
                            }
                            className="gap-2.5 text-[13px] font-medium rounded-control h-8 px-2.5"
                          >
                            <NavigationIcon icon={Folder} />
                            <span className="truncate">{project.name}</span>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <SidebarMenuAction
                                  aria-label={t("projectMenu", {
                                    name: project.name,
                                  })}
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
                                onClick={() => setProjectDialog({ project })}
                                className="gap-2 rounded-control py-1.5 text-xs"
                              >
                                <Pencil className="size-3.5 text-[var(--el-muted)]" />
                                <span>{t("rename")}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/w/${workspaceId}/projects/${project.projectId}`
                                  )
                                }
                                className="gap-2 rounded-control py-1.5 text-xs"
                              >
                                <Orbit className="size-3.5 text-[var(--el-muted)]" />
                                <span>{tNav("connectionMap")}</span>
                              </DropdownMenuItem>
                              {canDeleteProject && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(project)}
                                  className="gap-2 rounded-control py-1.5 text-xs text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>{tActions("delete")}</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </div>
            </Collapse>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      {onboarding}

      <SidebarGroup className="px-3.5 py-2">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarUsage
              workspaceId={workspaceId}
              onOpen={() => onOpenSettings("billing")}
            />
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  track("help_opened", { from: "sidebar" });
                  openSitePage(localePath(locale, "/help"), router.push);
                }}
                className="gap-2.5 text-[13px] font-medium rounded-control h-8 px-2.5"
              >
                <NavigationIcon icon={CircleHelp} />
                <span>{t("guide")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  track("feedback_opened", { from: "sidebar" });
                  setFeedbackOpen(true);
                }}
                className="gap-2.5 text-[13px] font-medium rounded-control h-8 px-2.5"
              >
                <NavigationIcon icon={MessageSquareText} />
                <span>{t("feedback")}</span>
                <UnseenCount count={feedbackUnseen} className="ml-auto" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarFooter className="p-0 border-t border-[var(--el-hairline)]">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                disabled={isLoggingOut}
                aria-label={isLoggingOut ? t("loggingOut") : undefined}
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
                <PersonAvatar
                  name={user?.userId ?? "?"}
                  image={user?.image}
                  size={28}
                />
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="block truncate text-[13px] font-semibold text-[var(--el-ink)] leading-tight">
                  {isLoggingOut
                    ? t("loggingOut")
                    : (user?.name ?? t("userFallback"))}
                </p>
                <p className="block truncate text-[11px] text-[var(--el-muted)] leading-tight">
                  {isLoggingOut ? t("pleaseWait") : (user?.email ?? "")}
                </p>
              </div>
              <Settings className="size-4 text-[var(--el-muted-soft)] shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-60">
            <DropdownMenuItem
              onClick={() => onOpenSettings("account")}
              className="gap-2 rounded-control py-2 text-sm"
            >
              <UserRound className="size-4 text-[var(--el-muted)]" />
              <span>{t("accountSettings")}</span>
            </DropdownMenuItem>
            {user && (
              <DropdownMenuItem
                onClick={() => {
                  track("onboarding_reopened");
                  updateChecklist(user.userId, (current) => ({
                    status: "open",
                    done: current?.done ?? [],
                  }));
                }}
                className="gap-2 rounded-control py-2 text-sm"
              >
                <ListChecks className="size-4 text-[var(--el-muted)]" />
                <span>{t("reopenOnboarding")}</span>
              </DropdownMenuItem>
            )}
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
              <span>{isLoggingOut ? t("loggingOut") : t("logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <FeedbackDialog
        open={feedbackOpen || inquiryId !== null}
        focusId={inquiryId}
        onOpenChange={(next) => {
          setFeedbackOpen(next);
          if (!next && inquiryId !== null)
            window.history.replaceState(
              null,
              "",
              hrefWithParam(INQUIRY_PARAM, null)
            );
        }}
      />
      <CreateWorkspaceDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
      />

      <Dialog
        open={projectDialog !== null}
        onOpenChange={(open) => !open && setProjectDialog(null)}
      >
        {projectDialog !== null && (
          <DialogContent aria-label={t("renameDialog.title")}>
            <form action={(formData) => void handleProjectRename(formData)}>
              <DialogHeader>
                <DialogTitle>{t("renameDialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("renameDialog.description")}
                </DialogDescription>
              </DialogHeader>
              <div className="py-5">
                <Label htmlFor="project-name">
                  {t("renameDialog.nameLabel")}
                </Label>
                <Input
                  id="project-name"
                  name="name"
                  className="mt-2"
                  maxLength={50}
                  required
                  autoFocus
                  defaultValue={projectDialog.project.name}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isProjectMutationPending}
                  onClick={() => setProjectDialog(null)}
                >
                  {tActions("cancel")}
                </Button>
                <Button type="submit" loading={isProjectMutationPending}>
                  {tActions("save")}
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
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>
              {tActions("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={deleteProject.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                const failure = await deleteProject
                  .mutateAsync({
                    workspaceId,
                    projectId: deleteTarget.projectId,
                  })
                  .then(() => null)
                  .catch((error: unknown) => error);
                const code = errorCodeOf(failure);
                if (failure === null || code === "PROJECT_NOT_FOUND") {
                  if (selectedProjectId === deleteTarget.projectId) {
                    onSelectProject(null);
                    if (!onNotes) router.push(notesHref);
                  }
                  await refreshProjects();
                  toast.success(t("toast.deleted"));
                } else if (code === "PROJECT_HAS_NOTES") {
                  toast.error(t("toast.hasNotes"));
                } else if (code === "WORKSPACE_ACCESS_DENIED") {
                  toast.error(t("toast.adminOnly"));
                } else {
                  toast.error(errorMessageOf(failure, t("toast.deleteFailed")));
                }
                setDeleteTarget(null);
              }}
            >
              {tActions("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NavigationIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  const t = useTranslations("shell.sidebar");
  return pending ? (
    <span role="status" aria-label={t("navigating")}>
      <Loader2
        className="size-4 animate-spin text-[var(--el-muted)]"
        aria-hidden
      />
    </span>
  ) : (
    <Icon className="size-4 text-[var(--el-muted)]" aria-hidden />
  );
}
