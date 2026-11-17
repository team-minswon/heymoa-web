"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

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
  getGetWorkspacesQueryKey,
  useCreateWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("common.createWorkspace");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const queryClient = useQueryClient();
  // **무효화와 이동을 mutation 안에 둔다.** action 쪽에 두면 POST가 끝나는 순간
  // `isPending`이 false로 떨어지고, 남은 목록 재조회 동안 만들기·취소·X가 다시 열린다 —
  // 한 번 더 누르면 워크스페이스가 둘 생긴다. TanStack은 `onSuccess`가 돌려준 프라미스를
  // 기다린 뒤에야 mutation을 끝내므로 `isPending`이 그 구간까지 덮는다.
  //
  // **자체 `createWorkspace.isPending` state로는 못 막는다.** React 19는 form action을 트랜지션으로 감싸고,
  // 그 안의 `useState` 갱신은 action이 끝나야 반영된다 — 잠그려는 바로 그 구간에 안 걸린다.
  const createWorkspace = useCreateWorkspace({
    mutation: {
      onSuccess: async (response) => {
        if (response.status !== 201 || !response.data.success) return;
        await queryClient.invalidateQueries({
          queryKey: getGetWorkspacesQueryKey(),
        });
        onOpenChange(false);
        router.push(`/w/${response.data.data.workspaceId}`);
      },
    },
  });
  // **이름을 state로 든다.** React 19는 action이 끝나면 uncontrolled 폼을 리셋하므로,
  // formData로만 읽으면 실패했을 때 방금 친 이름이 사라져 다시 타이핑하게 된다.
  const [name, setName] = useState("");

  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (!open) setName("");
  }

  const setOpen = (next: boolean) => {
    if (createWorkspace.isPending) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-label={t("ariaLabel")}
        showCloseButton={!createWorkspace.isPending}
      >
        <form
          action={async () => {
            const trimmed = name.trim();
            if (!trimmed) return;
            // **거절을 여기서 삼킨다.** React 19는 거절된 form action을 가장 가까운 오류
            // 경계로 올리는데, 워크스페이스 0개인 사람에게는 이것이 유일한 생성 흐름이라
            // 이름 400 하나에 랜딩이 통째로 오류 화면이 된다. 실패 알림은 전역
            // MutationCache.onError가 이미 맡는다.
            await createWorkspace
              .mutateAsync({ data: { name: trimmed, description: null } })
              .catch(() => null);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t("description")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Label htmlFor="new-workspace-name">{t("nameLabel")}</Label>
            <Input
              id="new-workspace-name"
              name="name"
              className="mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createWorkspace.isPending}
              onClick={() => setOpen(false)}
            >
              {tActions("cancel")}
            </Button>
            <Button
              type="submit"
              loading={createWorkspace.isPending}
              disabled={createWorkspace.isPending}
            >
              {tActions("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
