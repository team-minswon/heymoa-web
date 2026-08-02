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
import { SettingsRow } from "@/components/settings/settings-chrome";
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
    <>
      {/* 빨간 카드가 아니라 행이다 — 다이얼로그 안에서 카드를 또 쌓으면 깊이가 거짓말을 한다.
          경고는 색이 아니라 문장과 확인 단계가 진다(design.pen `Z60u3`). */}
      <SettingsRow
        label="워크스페이스 삭제"
        description={
          isDefault
            ? "기본 워크스페이스라 삭제할 수 없습니다. 다른 워크스페이스를 기본으로 바꾼 뒤 다시 시도하세요."
            : "이 워크스페이스의 회의·프로젝트·멤버가 함께 사라집니다. 되돌릴 수 없습니다."
        }
      >
        {isDefault ? (
          <Info
            aria-hidden
            className="size-3.5 shrink-0 text-[var(--el-muted)]"
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-9 border-[var(--el-error)] px-[13px] text-[13px] text-[var(--el-error)] hover:bg-[var(--el-error-bg)]"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="size-3.5" />
            삭제
          </Button>
        )}
      </SettingsRow>

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
    </>
  );
}
