"use client";

import { insertTaskIntoLists } from "@/lib/tasks/task-list-cache";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProjectTask } from "@/lib/api/generated/projects/projects";
import {
  assigneeRequestOf,
  type AssigneeChoice,
} from "@/lib/assignees/describe";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";

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
  const t = useTranslations("tasks");
  const tFields = useTranslations("common.fields");
  const tActions = useTranslations("common.actions");
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
        onSuccess: (response) => {
          if (response.status === 201 && response.data.success) {
            insertTaskIntoLists(queryClient, workspaceId, response.data.data);
          }
          void queryClient.invalidateQueries({
            predicate: ({ queryKey }) => isProjectTaskQueryKey(queryKey),
          });
          close();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !create.isPending && !next && close()}
    >
      {open && (
        <DialogContent
          aria-label={t("add")}
          showCloseButton={!create.isPending}
        >
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{t("add")}</DialogTitle>
              <DialogDescription>
                {t("newTask.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 py-5 text-[13px]">
              <Label htmlFor="new-task-content">{tFields("content")}</Label>
              <Input
                id="new-task-content"
                required
                autoFocus
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
              <span className="text-[var(--el-muted)]">{tFields("project")}</span>
              <Select
                items={Object.fromEntries(
                  projects.map((p) => [p.projectId, p.name])
                )}
                value={target}
                onValueChange={(value) => setProjectId(value as string)}
              >
                <SelectTrigger aria-label={tFields("project")} className="w-fit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem
                      key={project.projectId}
                      value={project.projectId}
                    >
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[var(--el-muted)]">{tFields("assignee")}</span>
              <AssigneeCell
                value={assignee}
                choices={choices}
                editable
                onChange={setAssignee}
                className="w-fit"
              />
              <span className="text-[var(--el-muted)]">{tFields("due")}</span>
              <DueCell
                value={due}
                editable
                onChange={setDue}
                className="w-fit"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={create.isPending}
                onClick={close}
              >
                {tActions("close")}
              </Button>
              <Button
                type="submit"
                loading={create.isPending}
                disabled={!trimmed || !target}
              >
                {tActions("add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
