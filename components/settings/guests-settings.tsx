"use client";

import { useId, useState } from "react";
import { UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { PERSON_NAME_MAX_LENGTH } from "@/components/settings/rename-person-dialog";
import { WorkspaceGuestsSettings } from "@/components/settings/workspace-guests-settings";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessageOf } from "@/lib/api/error-message";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import {
  getGetWorkspaceGuestsQueryKey,
  useCreateWorkspaceGuest,
} from "@/lib/api/generated/workspaces/workspaces";

/**
 * 설정의 임시 참여자 탭. 멤버 탭 아래에 붙어 있던 것을 따로 뗐다 — 멤버 목록과 같은 화면에 있으면 역할 변경·내보내기가
 * 임시 참여자에게도 있는 것처럼 읽히고, 참여자 추가 팝업의 「임시 참여자 관리」가 어디로 가는지도 흐려졌다.
 *
 * **목록은 전원이 보고 관리(연동·삭제)만 ADMIN이다.** 역할은 멤버 목록의 내 userId로 가른다(멤버 설정과 같은 규칙).
 * **추가는 전원이 한다** — 회의의 「참여자 추가」가 이미 멤버 누구에게나 임시 참여자를 만들게 한다.
 */
export function GuestsSettings({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const membersQuery = useGetWorkspaceMembers(workspaceId);
  const response = membersQuery.data;
  const members =
    response !== undefined && response.status === 200 && response.data.success
      ? (response.data.data?.members ?? [])
      : [];
  const myRole = members.find((member) => member.userId === user?.userId)?.role;
  const canManage = myRole === "ADMIN" && !membersQuery.isError;
  const [adding, setAdding] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SettingsHeader
        title="임시 참여자"
        description="계정 없이 회의에 참여한 사람입니다. 나중에 계정이 생기면 이어 붙일 수 있습니다."
        action={
          <Button
            size="sm"
            className="h-8 shrink-0"
            onClick={() => setAdding(true)}
          >
            <UserPlus />
            추가
          </Button>
        }
      />
      <WorkspaceGuestsSettings
        workspaceId={workspaceId}
        canManage={canManage}
        standalone
      />
      {adding ? (
        <AddGuestDialog
          workspaceId={workspaceId}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * 이름만 받아 회의에 붙이지 않은 임시 참여자를 만든다. 회의 화면의 「"이름" 추가」와 같은 사람이 생기고, 붙은 회의가 없어
 * 목록에는 「회의록 0개」로 선다.
 *
 * 이름 변경 대화상자(`RenamePersonDialog`)와 같은 꼴이다 — 실패하면 닫지 않고 서버 문구를 입력 아래 남긴다.
 * **같은 이름을 막지 않는다**(동명이인이 정상 입력, 서버와 같다).
 */
function AddGuestDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const inputId = useId();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateWorkspaceGuest({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const trimmed = value.trim();
  const blocked =
    trimmed.length === 0 || trimmed.length > PERSON_NAME_MAX_LENGTH;

  async function save() {
    if (blocked || create.isPending) return;
    setError(null);
    try {
      const response = await create.mutateAsync({
        workspaceId,
        data: { displayName: trimmed },
      });
      if (response.status !== 201 || !response.data.success) {
        setError("임시 참여자를 추가하지 못했습니다.");
        return;
      }
    } catch (caught) {
      setError(errorMessageOf(caught, "임시 참여자를 추가하지 못했습니다."));
      return;
    }
    // 목록(쪽 단위)과 회의의 참석자 후보가 같은 키 아래에 있다 — 둘 다 새 사람을 보게 한다.
    await queryClient.invalidateQueries({
      queryKey: getGetWorkspaceGuestsQueryKey(workspaceId),
    });
    onClose();
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>임시 참여자 추가</AlertDialogTitle>
          <AlertDialogDescription>
            계정 없이 회의에 참여하는 사람을 미리 만들어 둡니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor={inputId}>이름</Label>
              <span
                className="text-xs text-[var(--el-muted)] tabular-nums"
                aria-hidden
              >
                {trimmed.length}/{PERSON_NAME_MAX_LENGTH}
              </span>
            </div>
            <Input
              id={inputId}
              autoFocus
              value={value}
              maxLength={PERSON_NAME_MAX_LENGTH}
              aria-invalid={error !== null || undefined}
              disabled={create.isPending}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
            />
            {error ? (
              <p role="alert" className="text-xs text-[var(--el-error)]">
                {error}
              </p>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            <Button type="submit" loading={create.isPending} disabled={blocked}>
              추가
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
