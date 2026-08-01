"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getGetWorkspaceQueryKey,
  getGetWorkspacesQueryKey,
  useGetWorkspaceSuspense,
  useChangeDefaultWorkspace,
  useUpdateWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";
import { usePendingDefaultWorkspaceId } from "@/lib/workspaces/default-workspace";

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
  const setDefault = useChangeDefaultWorkspace({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const pendingDefaultId = usePendingDefaultWorkspaceId();
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

  const makeDefault = async () => {
    try {
      await setDefault.mutateAsync({ data: { workspaceId } });
      await refresh();
      toast.success("기본 워크스페이스로 설정했습니다.", {
        id: "workspace-settings-default",
      });
    } catch {
      toast.error("기본 워크스페이스를 변경하지 못했습니다.", {
        id: "workspace-settings-default",
      });
    }
  };

  return (
    // 제목은 SettingsPageShell 이 그린다 — 여기서 또 그리면 같은 말이 두 번 뜬다.
    <div className="space-y-5">
      {workspace?.isDefault ? (
        <div>
          <Badge>기본 워크스페이스</Badge>
        </div>
      ) : null}
      {/* 설정 폼은 카드에 안 담는다 — 패널이 이미 한 겹이라 두 겹이면 깊이가 거짓말을 한다. */}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workspace-name">워크스페이스 이름</Label>
          <Input id="workspace-name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-[12px] text-[var(--el-error)]">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workspace-description">설명</Label>
          <Textarea
            id="workspace-description"
            {...form.register("description")}
            rows={4}
          />
        </div>
        <div>
          <Button type="submit" loading={update.isPending}>
            변경 사항 저장
          </Button>
        </div>
      </form>
      {!workspace?.isDefault && (
        <div className="flex items-center justify-between gap-4 rounded-block border border-[var(--el-hairline)] bg-card p-5">
          <div>
            <p className="font-medium">기본 워크스페이스</p>
            <p className="text-sm text-[var(--el-muted)]">
              로그인 후 가장 먼저 열 공간으로 지정합니다.
            </p>
          </div>
          {/* 같은 명령을 내 계정 탭의 목록에서도 부를 수 있다. 각자 자기 isPending만 보면
            설정 탭을 옮기는 것만으로 두 요청이 겹치므로 전역 진행 상태를 함께 본다. */}
          <Button
            type="button"
            variant="outline"
            loading={pendingDefaultId === workspaceId}
            disabled={pendingDefaultId !== null}
            onClick={() => void makeDefault()}
          >
            기본 워크스페이스로 설정
          </Button>
        </div>
      )}
    </div>
  );
}

/** 워크스페이스 일반 설정 로딩 스켈레톤. settings-dialog가 DataBoundary fallback으로 쓴다. */
export function WorkspaceSettingsFormSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8"
      aria-label="워크스페이스 설정 불러오는 중"
    >
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-64 rounded-panel" />
    </div>
  );
}
