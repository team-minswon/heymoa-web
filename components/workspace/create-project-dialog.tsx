"use client";

import { useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import { toast } from "@/lib/ui/toast";
import {
  getGetProjectsQueryKey,
  useCreateProject,
} from "@/lib/api/generated/projects/projects";

/**
 * 프로젝트 만들기의 **단일 출처.** 입구가 셋이라 여기 모았다 — 사이드바 머리글의 `+`,
 * 상단바의 「새 노트」(프로젝트가 없을 때), 빈 상태의 「첫 프로젝트 만들기」.
 * 이름 변경은 사이드바가 계속 갖는다(대상이 있는 조작이라 입구가 하나뿐이다).
 *
 * `first`면 문구가 달라진다. 처음 들어온 사람에게는 **왜 프로젝트가 먼저인지**를 말해야
 * 하는데, 두 번째 프로젝트를 만드는 사람에게 그 설명은 군더더기다.
 */
export function CreateProjectDialog({
  workspaceId,
  open,
  first = false,
  onOpenChange,
  onCreated,
}: {
  workspaceId: string;
  open: boolean;
  /** 워크스페이스의 첫 프로젝트인가. 문구와 자리표시자가 갈린다. */
  first?: boolean;
  onOpenChange: (open: boolean) => void;
  /** 실제로 만들어졌을 때만 호출된다 — 호출부가 다음 단계로 이어 갈 신호다. */
  onCreated?: () => void;
}) {
  const t = useTranslations("workspace.createProject");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const createProject = useCreateProject({
    mutation: { meta: { suppressErrorToast: true } },
    // 연결이 반쯤 끊기면 응답이 영영 안 오고 창이 잠긴다 — 한도를 둔다(APP-1139)
    request: { timeoutMs: REQUEST_TIMEOUT_MS },
  });

  const submit = async (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    try {
      await createProject.mutateAsync({
        workspaceId,
        data: { name, description: null },
      });
      // 새 프로젝트가 목록의 어디에 끼는지는 서버 정렬이 정하므로 캐시에 손으로 못 넣는다.
      // **`await`가 중요하다** — 이어서 회의를 만들 때 `projects[0]`을 읽으므로, 목록이
      // 도착하기 전에 다음 단계를 열면 대상 프로젝트가 없어 만들기가 조용히 실패한다.
      await queryClient.invalidateQueries({
        queryKey: getGetProjectsQueryKey(workspaceId),
      });
      toast.success(t("created"));
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error(t("failed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) =>
        !createProject.isPending && !next && onOpenChange(false)
      }
    >
      {open && (
        <DialogContent
          aria-label={first ? t("titleFirst") : t("title")}
          showCloseButton={!createProject.isPending}
        >
          <form action={(formData) => void submit(formData)}>
            <DialogHeader>
              <DialogTitle>
                {first ? t("titleFirst") : t("title")}
              </DialogTitle>
              <DialogDescription>
                {first ? t("descriptionFirst") : t("description")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Label htmlFor="project-name">{t("nameLabel")}</Label>
              <Input
                id="project-name"
                name="name"
                className="mt-2"
                placeholder={first ? t("namePlaceholder") : undefined}
                // 서버 계약이 1~50자다.
                maxLength={50}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={createProject.isPending}
                onClick={() => onOpenChange(false)}
              >
                {tActions("cancel")}
              </Button>
              <Button type="submit" loading={createProject.isPending}>
                {tActions("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
