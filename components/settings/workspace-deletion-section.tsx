"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

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
import { forgetWorkspace } from "@/lib/workspace/cache";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";

/**
 * 설정 > 일반 맨 아래 「워크스페이스 삭제」(PRO-69 userflow 「워크스페이스 삭제」, APP-1383). ADMIN 에게만 그린다 —
 * 서버가 관리자 여부와 이름을 다시 본다. 이름 입력 → 요청 → 남은 워크스페이스, 없으면 홈(새로 만들기).
 */
export function WorkspaceDeletionSection({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const t = useTranslations("settings.workspaceDeletion");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaces = okData(useGetWorkspaces().data)?.workspaces ?? [];
  const recordingHere = isWorkspaceRecordingActive(useRecording(), workspaceId);
  const remove = useDeleteWorkspace();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = remove.isPending;
  const ready =
    confirmationMatches(typed, workspaceName) && !recordingHere && !busy;

  async function submit() {
    if (!ready) return;
    setError(null);
    try {
      await remove.mutateAsync({
        workspaceId,
        workspaceName: typed.trim(),
      });
    } catch (failure) {
      setError(errorMessageOf(failure, t("failed")));
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
        {t("title")}
      </h3>
      <p className="mt-1 text-xs leading-5 text-[var(--el-muted)]">
        {t.rich("description", { nowrap: nowrapChunks })}
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
        {t("title")}
      </Button>
      {recordingHere ? (
        <p role="status" className="mt-2 text-xs text-[var(--el-muted)]">
          {t("recordingBlocked")}
        </p>
      ) : null}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (remove.isPending) return;
          setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              {t("dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("dialog.description", { nowrap: nowrapChunks })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ConfirmPhraseField
            phrase={workspaceName}
            value={typed}
            onChange={setTyped}
            disabled={busy}
          />
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {tActions("cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              loading={busy}
              disabled={!ready}
              onClick={() => void submit()}
            >
              {tActions("delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function nowrapChunks(chunks: React.ReactNode) {
  return <span className="whitespace-nowrap">{chunks}</span>;
}
