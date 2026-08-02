"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetWorkspaceQueryKey,
  getGetWorkspacesQueryKey,
  useGetWorkspaceSuspense,
  useChangeDefaultWorkspace,
  useUpdateWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";
import { usePendingDefaultWorkspaceId } from "@/lib/workspaces/default-workspace";
import { DeleteWorkspaceCard } from "@/components/settings/delete-workspace-card";
import {
  SettingsGap,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-chrome";

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

  // 저장 버튼이 없다 — 값을 떠나면 저장한다(design.pen 「변경은 바로 저장됩니다」).
  // 버튼을 두면 「눌렀나 안 눌렀나」를 사용자가 기억해야 하고, 탭을 옮기면 조용히 날아간다.
  // `formState.isDirty` 는 프록시 구독이라 blur 핸들러 클로저에서 한 박자 늦다.
  // 서버 값과 직접 대보면 늦을 일이 없다.
  //
  // **저장은 직렬로 흘린다.** 이름을 고치고 설명으로 옮기면 PATCH 가 뜨고, 설명까지 고치면
  // 두 번째가 뜬다. 둘 다 폼 전체를 보내므로 응답이 역순으로 오면 **먼저 보낸 옛 값이
  // 최종값이 된다.** 앞 요청이 끝난 뒤에 다음을 보내면 마지막에 보낸 것이 마지막에 쓰인다.
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveOnBlur = () => {
    const values = form.getValues();
    const changed =
      values.name.trim() !== (workspaceName ?? "") ||
      (values.description ?? "").trim() !== (workspaceDescription ?? "");
    if (!changed) return;
    saveChainRef.current = saveChainRef.current
      .then(() => submit())
      .catch(() => {});
  };

  return (
    <>
      <SettingsSection title="워크스페이스" note="변경은 바로 저장됩니다">
        <SettingsRow
          label="이름"
          description="사이드바와 초대 메일에 이 이름이 그대로 나옵니다"
        >
          <FieldError message={form.formState.errors.name?.message}>
            <Input
              aria-label="워크스페이스 이름"
              className="h-9 w-[300px] text-[13px]"
              {...form.register("name")}
              onBlur={saveOnBlur}
            />
          </FieldError>
        </SettingsRow>
        <SettingsRow
          label="설명"
          description="목록과 초대 메일에서 이 워크스페이스가 무엇인지 알려줍니다"
        >
          <FieldError message={form.formState.errors.description?.message}>
            <Input
              aria-label="워크스페이스 설명"
              className="h-9 w-[300px] text-[13px]"
              {...form.register("description")}
              onBlur={saveOnBlur}
            />
          </FieldError>
        </SettingsRow>
        <SettingsRow
          label="기본 워크스페이스"
          description="로그인하면 이 워크스페이스로 바로 들어옵니다"
        >
          {/* 같은 명령을 내 계정 탭에서도 부를 수 있다. 각자 자기 isPending 만 보면
              탭을 옮기는 것만으로 두 요청이 겹치므로 전역 진행 상태를 함께 본다.
              이미 기본이면 끄는 길이 없다 — 기본은 언제나 하나는 있어야 한다. */}
          <Switch
            aria-label="기본 워크스페이스"
            checked={Boolean(workspace?.isDefault)}
            disabled={Boolean(workspace?.isDefault) || pendingDefaultId !== null}
            onCheckedChange={(checked) => {
              if (checked) void makeDefault();
            }}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsGap />

      <SettingsSection title="위험 구역">
        {workspace ? (
          <DeleteWorkspaceCard
            workspaceId={workspaceId}
            name={workspace.name}
            isDefault={workspace.isDefault}
          />
        ) : null}
      </SettingsSection>
    </>
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

/**
 * 즉시 저장 폼의 검증 실패를 화면에 남긴다. `handleSubmit` 은 값이 유효하지 않으면 조용히
 * 아무것도 안 보내는데, 화면이 「변경은 바로 저장됩니다」라고 말하고 있으므로 사용자는
 * 저장됐다고 믿는다. 왜 안 갔는지를 그 자리에 적는다.
 */
function FieldError({
  message,
  children,
}: {
  message?: string;
  children: React.ReactNode;
}) {
  if (!message) return children;
  return (
    <div className="flex flex-col items-end gap-1">
      {children}
      <span role="alert" className="text-[11px] text-[var(--el-error-strong)]">
        {message}
      </span>
    </div>
  );
}
