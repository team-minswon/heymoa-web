"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "@/lib/ui/toast";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { WorkspaceDeletionSection } from "@/components/settings/workspace-deletion-section";
import {
  getGetWorkspaceQueryKey,
  getGetWorkspacesQueryKey,
  useGetWorkspaceSuspense,
  useUpdateWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";

const NAME_REQUIRED = "nameRequired";
const workspaceSchema = z.object({
  name: z.string().trim().min(1, NAME_REQUIRED).max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
});
type WorkspaceValues = z.input<typeof workspaceSchema>;
type WorkspaceOutput = z.output<typeof workspaceSchema>;

export function WorkspaceSettingsForm({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const t = useTranslations("settings.workspace");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const query = useGetWorkspaceSuspense(workspaceId);
  const update = useUpdateWorkspace({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const workspace =
    query.data?.status === 200 && query.data.data.success
      ? query.data.data.data
      : undefined;
  const workspaceName = workspace?.name;
  const workspaceDescription = workspace?.description;
  const form = useForm<WorkspaceValues, unknown, WorkspaceOutput>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (workspaceName)
      form.reset({
        name: workspaceName,
        description: workspaceDescription ?? "",
      });
  }, [form, workspaceDescription, workspaceName]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceQueryKey(workspaceId),
      }),
      queryClient.invalidateQueries({ queryKey: getGetWorkspacesQueryKey() }),
    ]);
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ workspaceId, data: values });
      await refresh();
      toast.success(t("saved"), {
        id: "workspace-settings-save",
      });
    } catch {
      toast.error(t("saveFailed"), {
        id: "workspace-settings-save",
      });
    }
  });

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-8">
      <Header />
      <form onSubmit={submit} className={FORM}>
        <div className={FIELD}>
          <Label htmlFor="workspace-name">{t("name")}</Label>
          <Input id="workspace-name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-sm text-[var(--el-error)]">
              {form.formState.errors.name.message === NAME_REQUIRED
                ? t("nameRequired")
                : form.formState.errors.name.message}
            </p>
          )}
        </div>
        <div className={FIELD}>
          <Label htmlFor="workspace-description">{t("description")}</Label>
          <Textarea
            id="workspace-description"
            {...form.register("description")}
            rows={4}
          />
        </div>
        <Button
          type="submit"
          loading={update.isPending}
          className="rounded-full"
        >
          {tActions("saveChanges")}
        </Button>
      </form>
      {workspace?.role === "ADMIN" && workspaceName ? (
        <WorkspaceDeletionSection
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      ) : null}
    </div>
  );
}

export function WorkspaceSettingsFormSkeleton() {
  const t = useTranslations("settings.workspace");
  const tActions = useTranslations("common.actions");
  return (
    <div
      className="mx-auto w-full max-w-[720px] space-y-8"
      aria-label={t("loading")}
    >
      <Header />
      <div className={FORM}>
        <div className={FIELD}>
          <Label>{t("name")}</Label>
          <Skeleton className="h-8 rounded-control" />
        </div>
        <div className={FIELD}>
          <Label>{t("description")}</Label>
          <Skeleton className="h-16 rounded-control" />
        </div>
        <Button type="button" disabled className="rounded-full">
          {tActions("saveChanges")}
        </Button>
      </div>
    </div>
  );
}

function Header() {
  const t = useTranslations("settings.workspace");
  return <SettingsHeader title={t("title")} description={t("intro")} />;
}

const FORM =
  "space-y-5 rounded-panel border border-[var(--el-hairline)] bg-white p-6";
const FIELD = "space-y-2";
