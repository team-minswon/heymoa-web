"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "@/lib/ui/toast";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SettingsHeader } from "@/components/settings/settings-layout";
import {
  getGetWorkspaceQueryKey,
  getGetWorkspacesQueryKey,
  useGetWorkspaceSuspense,
  useUpdateWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";

const workspaceSchema = z.object({
  name: z.string().trim().min(1, "워크스페이스 이름을 입력해 주세요.").max(80),
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
      toast.success("변경사항을 저장했습니다.", {
        id: "workspace-settings-save",
      });
    } catch {
      toast.error("워크스페이스 정보를 저장하지 못했습니다.", {
        id: "workspace-settings-save",
      });
    }
  });

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-8">
      <Header />
      <form onSubmit={submit} className={FORM}>
        <div className={FIELD}>
          <Label htmlFor="workspace-name">워크스페이스 이름</Label>
          <Input id="workspace-name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-sm text-[var(--el-error)]">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
        <div className={FIELD}>
          <Label htmlFor="workspace-description">설명</Label>
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
          변경사항 저장
        </Button>
      </form>
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
  return (
    <div
      className="mx-auto w-full max-w-[720px] space-y-8"
      aria-label="워크스페이스 설정 불러오는 중"
    >
      <Header />
      <div className={FORM}>
        <div className={FIELD}>
          <Label>워크스페이스 이름</Label>
          <Skeleton className="h-8 rounded-control" />
        </div>
        <div className={FIELD}>
          <Label>설명</Label>
          <Skeleton className="h-16 rounded-control" />
        </div>
        <Button type="button" disabled className="rounded-full">
          변경사항 저장
        </Button>
      </div>
    </div>
  );
}

function Header() {
  return (
    <SettingsHeader
      title="일반"
      description="이 공간의 이름과 설명을 관리합니다."
    />
  );
}

const FORM =
  "space-y-5 rounded-panel border border-[var(--el-hairline)] bg-white p-6";
const FIELD = "space-y-2";
