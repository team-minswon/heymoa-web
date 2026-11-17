"use client";

import { useId, useState } from "react";
import { UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

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

export function GuestsSettings({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("settings.guests");
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
        title={t("title")}
        description={t("description")}
        action={
          <Button
            size="sm"
            className="h-8 shrink-0"
            onClick={() => setAdding(true)}
          >
            <UserPlus />
            {t("add")}
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

function AddGuestDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const t = useTranslations("settings.guests");
  const tActions = useTranslations("common.actions");
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
        setError(t("addDialog.failed"));
        return;
      }
    } catch (caught) {
      setError(errorMessageOf(caught, t("addDialog.failed")));
      return;
    }
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
          <AlertDialogTitle>{t("addDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("addDialog.description")}
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
              <Label htmlFor={inputId}>{t("nameLabel")}</Label>
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
            <AlertDialogCancel type="button">
              {tActions("cancel")}
            </AlertDialogCancel>
            <Button type="submit" loading={create.isPending} disabled={blocked}>
              {t("add")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
