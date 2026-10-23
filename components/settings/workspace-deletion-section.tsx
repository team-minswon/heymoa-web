"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorNote } from "@/components/settings/account-deletion-section";
import { ConfirmPhraseField } from "@/components/settings/confirm-phrase-field";
import {
  isWorkspaceRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  confirmationMatches,
  useDeleteWorkspace,
} from "@/lib/account/deletion-api";
import { errorMessageOf } from "@/lib/api/error-message";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import {
  REAUTH_BLOCKED_MESSAGE,
  REAUTH_FAILED_MESSAGE,
  useReauth,
} from "@/lib/auth/reauth";
import { forgetWorkspace } from "@/lib/workspace/cache";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";

/**
 * 설정 > 일반 맨 아래 「워크스페이스 삭제」(PRO-69 userflow 「워크스페이스 삭제」, APP-1383). ADMIN 에게만 그린다 —
 * 서버가 관리자 여부와 이름을 다시 본다. 이름 입력 → Google 재로그인 → 요청 → 남은 워크스페이스, 없으면 홈(새로 만들기).
 */
export function WorkspaceDeletionSection({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaces = okData(useGetWorkspaces().data)?.workspaces ?? [];
  const recordingHere = isWorkspaceRecordingActive(useRecording(), workspaceId);
  const remove = useDeleteWorkspace();
  const reauth = useReauth("WORKSPACE_DELETION");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = reauth.waiting || remove.isPending;
  const ready =
    confirmationMatches(typed, workspaceName) && !recordingHere && !busy;

  async function submit() {
    if (!ready) return;
    setError(null);
    const verified = await reauth.run();
    if (verified === "blocked") return setError(REAUTH_BLOCKED_MESSAGE);
    if (!verified.ok) return setError(REAUTH_FAILED_MESSAGE);
    try {
      await remove.mutateAsync({
        workspaceId,
        workspaceName: typed.trim(),
      });
    } catch (failure) {
      setError(errorMessageOf(failure, "워크스페이스를 삭제하지 못했습니다."));
      return;
    }
    // 목적지를 먼저 고른 뒤 캐시를 걷는다(나가기와 같은 순서·규칙, `members-settings`).
    const next = pickWorkspaceId(
      workspaces.filter((item) => item.workspaceId !== workspaceId)
    );
    setOpen(false);
    forgetWorkspace(queryClient, workspaceId);
    void queryClient.invalidateQueries();
    router.replace(next ? `/w/${next}` : "/");
  }

  return (
    <section className="rounded-panel border border-[var(--el-hairline)] bg-white p-6">
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        워크스페이스 삭제
      </h3>
      <p className="mt-1 text-xs leading-5 text-[var(--el-muted)]">
        노트·전사·음성·채팅·연동·초대를 모두 지우고, 멤버 모두의 접근을 바로
        막습니다. 멤버에게는 메일로 알립니다.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-[30px]"
        disabled={recordingHere}
        onClick={() => {
          setError(null);
          setTyped("");
          setOpen(true);
        }}
      >
        워크스페이스 삭제
      </Button>
      {recordingHere ? (
        <p role="status" className="mt-2 text-xs text-[var(--el-muted)]">
          녹음을 끝낸 뒤 삭제할 수 있습니다.
        </p>
      ) : null}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (remove.isPending) return;
          if (!next) reauth.cancel();
          setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              이 워크스페이스를 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              노트·전사·음성·채팅·연동·초대가 모두 지워지고 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ConfirmPhraseField
            phrase={workspaceName}
            value={typed}
            onChange={setTyped}
            disabled={busy}
          />
          {reauth.waiting ? (
            <p role="status" className="text-xs text-[var(--el-muted)]">
              Google 창에서 다시 로그인해 주세요.
            </p>
          ) : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              취소
            </AlertDialogCancel>
            <Button
              variant="destructive"
              loading={busy}
              disabled={!ready}
              onClick={() => void submit()}
            >
              Google로 확인하고 삭제
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
