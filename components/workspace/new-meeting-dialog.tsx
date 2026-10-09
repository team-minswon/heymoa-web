"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
 * 「새 회의」의 생성 단계.
 *
 * **만들기와 시작은 별개다.** 예전에는 제목도 안 묻고 `"실시간 기록 노트"`로 만들어 곧장
 * 전사 화면으로 보냈고, 그래서 만들자마자 기록해야 하는 화면처럼 읽혔다. 여기서 이름을 짓고,
 * 기록은 노트 안에서 「회의 시작」을 눌러야 시작된다.
 *
 * 입력을 controlled로 둔 이유가 둘이다. 함수형 form action은 완료되면 비제어 입력을 비우는데,
 * **실패했을 때 사용자가 쓴 이름이 사라지면 안 된다.** 그리고 React 19는 거절된 action을 오류
 * 경계로 올리므로 실패를 action 안에서 삼켜야 하는데, 삼키면 action이 성공으로 끝나 또 비워진다.
 * 값을 우리가 들고 있으면 둘 다 걸리지 않는다.
 */
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
  /** 실제로 만들어졌으면 true. 그때만 입력을 비운다. */
  onSubmit: (title: string, projectId: string) => Promise<boolean>;
  isPending: boolean;
  workspaceId: string;
  projects: { projectId: string; name: string }[];
  /** 지금 보고 있는 프로젝트. 「모든 노트」에서 열었으면 null 이다. */
  defaultProjectId: string | null;
}) {
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const trimmed = title.trim();
  /**
   * **회의가 어느 프로젝트에 속하는지는 만들 때 정해지고 그 뒤로 못 바꾼다** (APP-1033) — 분석이 그 프로젝트의 지식으로
   * 대조하고 확정이 그 프로젝트에 쌓이므로, 나중에 옮기면 두 프로젝트의 지식이 섞인다. 그래서 여기서 보여 주고 고르게 한다.
   * 기본값은 보고 있던 프로젝트, 「모든 노트」에서는 마지막으로 쓴 프로젝트다(없으면 첫 프로젝트).
   */
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
        <DialogContent
          aria-label="새 회의 만들기"
          // 처리 중에는 X를 안 그린다 — onOpenChange가 닫기를 무시하므로, 두면 눌러도
          // 아무 일이 없어 고장으로 읽힌다.
          showCloseButton={!isPending}
        >
          <form
            action={async () => {
              if (!trimmed) return;
              // 성공했을 때만 비운다. 부모는 닫기만 하므로 여기서 안 비우면 다음에 열었을 때
              // 지난 회의 이름이 그대로 남는다.
              //
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
              <DialogTitle>새 회의 만들기</DialogTitle>
              <DialogDescription>
                이름을 지어 두면 나중에 찾기 쉽습니다. 기록은 만든 뒤에
                시작합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Label htmlFor="meeting-title">회의 이름</Label>
              <Input
                id="meeting-title"
                name="title"
                className="mt-2"
                placeholder="주간 제품 회의"
                // 서버 계약이 1~200자다.
                maxLength={200}
                required
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <div className="mt-4">
                <Label htmlFor="meeting-project">프로젝트</Label>
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
                      aria-label="프로젝트"
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
                  회의를 만든 뒤에는 프로젝트를 바꿀 수 없습니다.
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
                취소
              </Button>
              <Button
                type="submit"
                loading={isPending}
                disabled={!trimmed || !target}
              >
                만들기
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

/** 이 워크스페이스에서 마지막으로 회의를 만든 프로젝트. 지금 목록에 없으면(지워졌다) 없는 것이다. 브라우저 저장소가 막혀도 화면은 그대로다. */
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
  } catch {
    // 저장은 편의일 뿐이다.
  }
}
