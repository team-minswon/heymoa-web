"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AssigneeCell } from "@/components/heymoa/assignee-cell";
import { DueCell } from "@/components/heymoa/due-cell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProjectTask } from "@/lib/api/generated/projects/projects";
import { assigneeRequestOf, type AssigneeChoice } from "@/lib/assignees/describe";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";

/**
 * 회의 밖에서 생긴 할 일을 프로젝트에 더한다. 담당은 사람만 고른다 — 화자는 회의 안에서만 뜻이 있다.
 * 입력은 우리가 들고 있어서 실패해도 쓴 내용이 남는다. 실패 알림은 전역 토스트가 맡는다.
 */
export function NewTaskDialog({
  workspaceId,
  open,
  onOpenChange,
  projects,
  defaultProjectId,
  choices,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Array<{ projectId: string; name: string }>;
  defaultProjectId: string | null;
  choices: AssigneeChoice[];
}) {
  const queryClient = useQueryClient();
  const create = useCreateProjectTask();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [assignee, setAssignee] = useState<AssigneeChoice | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const target = projectId ?? defaultProjectId;
  const trimmed = content.trim();

  const close = () => {
    setProjectId(null);
    setContent("");
    setAssignee(null);
    setDue(null);
    onOpenChange(false);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || !target) return;
    create.mutate(
      {
        workspaceId,
        projectId: target,
        data: { content: trimmed, assignee: assigneeRequestOf(assignee), due },
      },
      {
        onSuccess: () => {
          // **목록이 둘이다** (APP-685). 프로젝트 키만 비우면 방금 만든 할 일이
          // 「모든 할 일」 화면에 안 나타난다 — 에러도 경고도 없다.
          void queryClient.invalidateQueries({
            predicate: ({ queryKey }) => isProjectTaskQueryKey(queryKey),
          });
          close();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !create.isPending && !next && close()}>
      {open && (
        <DialogContent aria-label="할 일 추가" showCloseButton={!create.isPending}>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>할 일 추가</DialogTitle>
              <DialogDescription>회의 밖에서 생긴 일도 프로젝트 할 일로 둡니다.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 py-5 text-[13px]">
              <Label htmlFor="new-task-content">내용</Label>
              <Input
                id="new-task-content"
                required
                autoFocus
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
              <span className="text-[var(--el-muted)]">프로젝트</span>
              <Select
                items={Object.fromEntries(projects.map((p) => [p.projectId, p.name]))}
                value={target}
                onValueChange={(value) => setProjectId(value as string)}
              >
                <SelectTrigger aria-label="프로젝트" className="w-fit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.projectId} value={project.projectId}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[var(--el-muted)]">담당</span>
              <AssigneeCell value={assignee} choices={choices} editable onChange={setAssignee} className="w-fit" />
              <span className="text-[var(--el-muted)]">기한</span>
              <DueCell value={due} editable onChange={setDue} className="w-fit" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={create.isPending} onClick={close}>
                닫기
              </Button>
              <Button type="submit" loading={create.isPending} disabled={!trimmed || !target}>
                추가
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
