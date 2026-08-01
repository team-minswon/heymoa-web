"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Info, Trash2 } from "lucide-react";
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
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetWorkspacesQueryKey,
  useDeleteWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";

/**
 * design.pen `upeDP` 아래쪽 빨간 박스. 되돌릴 수 없는 것이라 확인을 한 번 받는다 —
 * `Dialog` 가 아니라 `AlertDialog` 인 이유다(파괴적 확인의 자리).
 *
 * 기본 워크스페이스는 계약이 409 로 막는다. 눌러서 실패를 보는 것보다 **왜 못 하는지**를
 * 먼저 적는 게 낫다 — 버튼을 감추면 「여긴 왜 삭제가 없지」가 된다.
 */
export function DeleteWorkspaceCard({
  workspaceId,
  name,
  isDefault,
}: {
  workspaceId: string;
  name: string;
  isDefault: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useDeleteWorkspace({
    mutation: { meta: { suppressErrorToast: true } },
  });

  const confirm = async () => {
    try {
      const response = await remove.mutateAsync({ workspaceId });
      if (response.status !== 204) {
        toast.error("워크스페이스를 삭제하지 못했습니다.");
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: getGetWorkspacesQueryKey(),
      });
      setOpen(false);
      // 방금 지운 곳에 남아 있을 수 없다. 남은 워크스페이스는 진입점이 고른다.
      router.replace("/");
    } catch (error) {
      if (errorCodeOf(error) === "DEFAULT_WORKSPACE") {
        toast.error("기본 워크스페이스는 삭제할 수 없습니다.");
        return;
      }
      toast.error(errorMessageOf(error, "워크스페이스를 삭제하지 못했습니다."));
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-control border border-[var(--el-error)] bg-[var(--el-error-bg)] p-4">
      <h3 className="text-[13px] font-bold text-[var(--el-error-strong)]">
        워크스페이스 삭제
      </h3>
      <p className="text-[12px] leading-[19px] text-[var(--el-error-strong)]">
        이 워크스페이스의 회의·프로젝트·멤버가 함께 사라집니다. 되돌릴 수
        없습니다.
      </p>
      {isDefault ? (
        <p className="flex gap-2 text-[12px] leading-[19px] text-[var(--el-error-strong)]">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          기본 워크스페이스라 삭제할 수 없습니다. 다른 워크스페이스를 기본으로
          바꾼 뒤 다시 시도하세요.
        </p>
      ) : (
        <div>
          <Button
            type="button"
            variant="destructive"
            className="bg-[var(--el-error)] text-[var(--el-on-primary)] hover:bg-[var(--el-error)]/90"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="size-3.5" />
            워크스페이스 삭제
          </Button>
        </div>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              「{name}」을(를) 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 워크스페이스의 회의·프로젝트·멤버가 함께 사라집니다. 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={remove.isPending}
              onClick={() => void confirm()}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
