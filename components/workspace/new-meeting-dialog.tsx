"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { viewerDateKey } from "@/lib/format/date";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 입력을 controlled로 둔 이유가 둘이다. 함수형 form action은 완료되면 비제어 입력을 비우는데,
 * **실패했을 때 사용자가 쓴 이름이 사라지면 안 된다.** 그리고 React 19는 거절된 action을 오류
 * 경계로 올리므로 실패를 action 안에서 삼켜야 하는데, 삼키면 action이 성공으로 끝나 또 비워진다.
 * 값을 우리가 들고 있으면 둘 다 걸리지 않는다.
 */
function defaultMeetingTitle(
  t: ReturnType<typeof useTranslations<"workspace.newMeeting">>
) {
  const [, month, day] = viewerDateKey(new Date()).split("-");
  return t("defaultTitle", { month, day });
}

export function NewMeetingDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  workspaceId,
  projects,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string, projectId: string) => Promise<boolean>;
  isPending: boolean;
  workspaceId: string;
  projects: { projectId: string; name: string }[];
  defaultProjectId: string | null;
}) {
  const t = useTranslations("workspace.newMeeting");
  const tActions = useTranslations("common.actions");
  const [title, setTitle] = useState(() =>
    open ? defaultMeetingTitle(t) : ""
  );
  const [picked, setPicked] = useState<string | null>(null);
  const trimmed = title.trim();
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setTitle("");
      setPicked(null);
    } else {
      setTitle(defaultMeetingTitle(t));
    }
  }
  const fallback =
    (defaultProjectId && projects.some((p) => p.projectId === defaultProjectId)
      ? defaultProjectId
      : null) ??
    lastMeetingProject(workspaceId, projects) ??
    projects[0]?.projectId ??
    null;
  const target =
    picked && projects.some((p) => p.projectId === picked) ? picked : fallback;

  const close = () => {
    setTitle("");
    setPicked(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && !next && close()}>
      {open && (
        <DialogContent aria-label={t("title")} showCloseButton={!isPending}>
          <form
            action={async () => {
              if (!trimmed) return;
              // 실패는 전역 `MutationCache`가 토스트로 알린다. 여기서 안 삼키면 React가
              // 거절을 오류 경계로 올려 워크스페이스 전체가 오류 화면이 된다.
              if (!target) return;
              const created = await onSubmit(trimmed, target).catch(
                () => false
              );
              if (created) {
                rememberMeetingProject(workspaceId, target);
                setTitle("");
                setPicked(null);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>
                <span className="block">{t("descriptionName")}</span>
                <span className="block">{t("descriptionRecord")}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Label htmlFor="meeting-title">{t("nameLabel")}</Label>
              <Input
                id="meeting-title"
                name="title"
                className="mt-2"
                placeholder={t("namePlaceholder")}
                maxLength={200}
                required
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <div className="mt-4">
                <Label htmlFor="meeting-project">{t("projectLabel")}</Label>
                {projects.length > 1 ? (
                  <Select
                    items={Object.fromEntries(
                      projects.map((p) => [p.projectId, p.name])
                    )}
                    value={target}
                    onValueChange={(value) => setPicked(value as string)}
                  >
                    <SelectTrigger
                      id="meeting-project"
                      aria-label={t("projectLabel")}
                      className="mt-2 w-full"
                    >
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
                ) : (
                  <p
                    id="meeting-project"
                    className="mt-2 text-sm text-[var(--el-ink)]"
                  >
                    {projects[0]?.name}
                  </p>
                )}
                <p className="mt-2 text-xs text-[var(--el-muted)]">
                  {t("projectLocked")}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={close}
              >
                {tActions("cancel")}
              </Button>
              <Button
                type="submit"
                loading={isPending}
                disabled={!trimmed || !target}
              >
                {tActions("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

const LAST_PROJECT_KEY = (workspaceId: string) =>
  `heymoa:last-meeting-project:${workspaceId}`;

function lastMeetingProject(
  workspaceId: string,
  projects: { projectId: string }[]
): string | null {
  try {
    const id = window.localStorage.getItem(LAST_PROJECT_KEY(workspaceId));
    return id && projects.some((p) => p.projectId === id) ? id : null;
  } catch {
    return null;
  }
}

function rememberMeetingProject(workspaceId: string, projectId: string) {
  try {
    window.localStorage.setItem(LAST_PROJECT_KEY(workspaceId), projectId);
  } catch {}
}
