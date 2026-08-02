"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Folder, FolderPlus, MoreHorizontal } from "lucide-react";
import { SettingsRow, SettingsSection } from "@/components/settings/settings-chrome";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectResponseData } from "@/lib/api/generated/models";
import {
  getGetProjectsQueryKey,
  useCreateProject,
  useDeleteProject,
  useGetProjectsSuspense,
  useUpdateProject,
} from "@/lib/api/generated/projects/projects";

export function ProjectsSettingsSkeleton() {
  return (
    <div className="rounded-panel border border-[var(--el-hairline)] bg-card p-1">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex h-14 items-center gap-3 px-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="ml-auto h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ProjectsSettings({ workspaceId }: { workspaceId: string }) {
  const client = useQueryClient();
  const query = useGetProjectsSuspense(workspaceId);
  const projects: ProjectResponseData[] =
    query.data.status === 200 && query.data.data.success
      ? (query.data.data.data.projects ?? [])
      : [];

  const [renaming, setRenaming] = useState<ProjectResponseData | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<ProjectResponseData | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () =>
    client.invalidateQueries({ queryKey: getGetProjectsQueryKey(workspaceId) });

  const update = useUpdateProject({
    mutation: {
      onSuccess: () => {
        void invalidate();
        setRenaming(null);
        toast.success("프로젝트 이름을 바꿨습니다.");
      },
    },
  });
  // design.pen `HinaA` 는 만들기를 섹션 머리에 둔다 — 사이드바 「＋」와 같은 명령이지만
  // 목록을 보는 자리에서 바로 만들 수 있어야 「여기서는 왜 못 만들지」가 안 생긴다.
  const create = useCreateProject({
    mutation: {
      onSuccess: () => {
        void invalidate();
        setCreating(false);
        setName("");
        toast.success("프로젝트를 만들었습니다.");
      },
    },
  });
  const remove = useDeleteProject({
    mutation: {
      onSuccess: () => {
        void invalidate();
        setDeleting(null);
        toast.success("프로젝트를 삭제했습니다.");
      },
    },
  });

  return (
    <>
      <SettingsSection
        title="프로젝트"
        count={projects.length ? `${projects.length}개` : undefined}
        action={
          <Button
            type="button"
            variant="outline"
            className="h-8 px-2.5 text-[12px]"
            onClick={() => {
              setName("");
              setCreating(true);
            }}
          >
            <FolderPlus className="size-3.5" />
            프로젝트 만들기
          </Button>
        }
      >
        {projects.length === 0 ? (
          <SettingsRow
            label="프로젝트가 없습니다"
            description="회의를 담을 첫 프로젝트를 만드세요"
          />
        ) : null}
        {projects.map((project) => (
          <SettingsRow
            key={project.projectId}
            data-testid="project-settings-row"
            label={project.name}
            description={
              project.isDefault
                ? "프로젝트를 고르지 않은 회의가 여기로 갑니다"
                : (project.description ?? undefined)
            }
            icon={<Folder className="size-3.5 text-[var(--el-muted)]" />}
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`${project.name} 메뉴`}
                className="flex size-[30px] items-center justify-center rounded-control text-[var(--el-muted)] hover:bg-[var(--el-surface-strong)]"
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setRenaming(project);
                    setName(project.name);
                  }}
                >
                  이름 변경
                </DropdownMenuItem>
                {/* 기본 프로젝트는 지울 수 없다 — 「새 회의」가 갈 곳을 잃는다. */}
                <DropdownMenuItem
                  variant="destructive"
                  disabled={project.isDefault}
                  onClick={() => setDeleting(project)}
                >
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SettingsRow>
        ))}
      </SettingsSection>

      <Dialog
        open={renaming !== null || creating}
        onOpenChange={(open) => {
          if (open) return;
          setRenaming(null);
          setCreating(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {creating ? "새 프로젝트" : "프로젝트 이름 변경"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="project-name">이름</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenaming(null);
                setCreating(false);
              }}
            >
              취소
            </Button>
            <Button
              loading={update.isPending || create.isPending}
              disabled={!name.trim()}
              onClick={() => {
                if (creating) {
                  create.mutate({ workspaceId, data: { name: name.trim() } });
                  return;
                }
                if (renaming)
                  update.mutate({
                    workspaceId,
                    projectId: renaming.projectId,
                    data: {
                      name: name.trim(),
                      description: renaming.description ?? undefined,
                    },
                  });
              }}
            >
              {creating ? "만들기" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              「{deleting?.name}」을 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              프로젝트를 지우면 그 안의 회의도 함께 사라집니다. 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleting) {
                  remove.mutate({
                    workspaceId,
                    projectId: deleting.projectId,
                  });
                }
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
