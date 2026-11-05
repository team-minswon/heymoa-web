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
  // 문구는 그릴 때 언어 파일에서 고른다 — 스키마는 모듈 수준이라 화면 언어를 모른다.
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
  // suspense — 로딩/에러는 settings-dialog의 DataBoundary가 잡는다. 200 봉투가 보장되므로
  // 아래 workspace?. 옵셔널은 타입 안전용이며 런타임엔 항상 값이 있다.
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
      {/* 관리자에게만 보인다(PRO-69). 이름은 저장된 값과 비교한다 — 폼에 고치는 중인 값이 아니다. */}
      {workspace?.role === "ADMIN" && workspaceName ? (
        <WorkspaceDeletionSection
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      ) : null}
    </div>
  );
}

/**
 * 워크스페이스 일반 설정 로딩 스켈레톤. settings-dialog가 DataBoundary fallback으로 쓴다.
 *
 * **머리글·라벨·버튼은 가리지 않는다** — 고정 문구다. 값이 들어갈 입력 칸만 막대로 둔다. 폼 틀(`FORM`·`FIELD`)은
 * 실제와 같은 상수를 읽어, 한쪽 여백만 고쳐 어긋나는 일이 없게 한다. 설명 칸은 `field-sizing-content` 라
 * 내용이 짧으면 최소 높이(`min-h-16`)에 선다.
 */
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
