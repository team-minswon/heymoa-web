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
import { Textarea } from "@/components/ui/textarea";
import {
  getGetWorkspaceQueryKey,
  getGetWorkspacesQueryKey,
  useGetWorkspace,
  useChangeDefaultWorkspace,
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
  const query = useGetWorkspace(workspaceId);
  const update = useUpdateWorkspace();
  const setDefault = useChangeDefaultWorkspace();
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
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-3xl font-light tracking-[-0.025em]">
            워크스페이스 일반
          </h2>
          {workspace?.isDefault && <Badge>기본</Badge>}
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
          이 공간의 이름과 설명을 관리합니다.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="space-y-5 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
      >
        <div className="space-y-2">
          <Label htmlFor="workspace-name">워크스페이스 이름</Label>
          <Input id="workspace-name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-sm text-[var(--el-error)]">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
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
      {!workspace?.isDefault && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--el-hairline)] bg-white p-5">
          <div>
            <p className="font-medium">기본 워크스페이스</p>
            <p className="text-sm text-[var(--el-muted)]">
              로그인 후 가장 먼저 열 공간으로 지정합니다.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            loading={setDefault.isPending}
            onClick={() => void makeDefault()}
            className="rounded-full"
          >
            기본 워크스페이스로 설정
          </Button>
        </div>
      )}
    </div>
  );
}
