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
  const remove = useDeleteProject({
    mutation: {
      onSuccess: () => {
        void invalidate();
        setDeleting(null);
        toast.success("프로젝트를 삭제했습니다.");
      },
    },
  });

  if (!projects.length) {
    return (
      <div className="rounded-panel border border-[var(--el-hairline)] bg-card px-8 py-14 text-center">
        <p className="text-[15px] font-medium">프로젝트가 없습니다</p>
        <p className="mt-2 text-[13px] text-[var(--el-muted)]">
          사이드바의 「＋」로 첫 프로젝트를 만드세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-card">
        {projects.map((project) => (
          <li
            key={project.projectId}
            data-testid="project-settings-row"
            className="flex min-h-14 items-center gap-3 border-b border-[var(--el-hairline)] px-4 py-3 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {project.name}
                {project.isDefault ? (
                  <span className="ml-2 rounded-chip bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-[var(--el-body)]">
                    기본
                  </span>
                ) : null}
              </span>
              {project.description ? (
                <span className="mt-0.5 block truncate text-[12px] text-[var(--el-muted)]">
                  {project.description}
                </span>
              ) : null}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRenaming(project);
                setName(project.name);
              }}
            >
              이름 변경
            </Button>
            {/* 기본 프로젝트는 지울 수 없다 — 「새 회의」가 갈 곳을 잃는다. */}
            <Button
              variant="ghost"
              size="sm"
              disabled={project.isDefault}
              onClick={() => setDeleting(project)}
              className="text-[var(--destructive)]"
            >
              삭제
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로젝트 이름 변경</DialogTitle>
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
            <Button variant="outline" onClick={() => setRenaming(null)}>
              취소
            </Button>
            <Button
              loading={update.isPending}
              disabled={!name.trim()}
              onClick={() =>
                renaming &&
                update.mutate({
                  workspaceId,
                  projectId: renaming.projectId,
                  data: {
                    name: name.trim(),
                    description: renaming.description ?? undefined,
                  },
                })
              }
            >
              저장
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
