"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessageOf } from "@/lib/api/error-message";
import { useGetCurrentUserSuspense } from "@/lib/api/generated/users/users";
import { usePendingDefaultWorkspaceId } from "@/lib/workspaces/default-workspace";
import {
  getGetWorkspacesQueryKey,
  useChangeDefaultWorkspace,
  useGetWorkspacesSuspense,
} from "@/lib/api/generated/workspaces/workspaces";

export function AccountSettingsForm() {
  const response = useGetCurrentUserSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error("계정 정보를 불러오지 못했습니다.");
  }
  const user = response.data.data;

  return (
    <div className="mx-auto max-w-2xl space-y-8" aria-label="내 계정 설정">
      <div>
        <h2 className="font-serif text-3xl font-light tracking-[-0.025em]">
          내 계정
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
          프로필 정보를 확인합니다.
        </p>
      </div>
      <div className="flex items-center gap-5 rounded-panel border border-[var(--el-hairline)] bg-white p-6">
        <Avatar className="size-14">
          {user.image ? (
            <AvatarImage src={user.image} alt={`${user.name} 프로필`} />
          ) : null}
          <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="account-email">이메일</Label>
          <Input id="account-email" value={user.email} disabled />
        </div>
      </div>
      <div className="space-y-2 rounded-panel border border-[var(--el-hairline)] bg-white p-6">
        <Label htmlFor="account-name">이름</Label>
        <Input id="account-name" value={user.name} disabled />
      </div>
      {/* 워크스페이스 목록은 이 화면의 부가 조회다 — 그것만 실패했다고 이미 받아 온
        이메일·이름까지 함께 걷지 않도록 자기 경계를 둔다. 바깥 DataBoundary는
        settings-dialog가 계정 탭 전체에 두고 있다. */}
      <DataBoundary
        fallback={<Skeleton className="h-44 rounded-panel" />}
        errorLabel="워크스페이스 목록을 불러오지 못했습니다"
      >
        <DefaultWorkspaceSection />
      </DataBoundary>
    </div>
  );
}

/**
 * 기본 워크스페이스는 워크스페이스 자원이 아니라 유저 자원이다 —
 * `PUT /v1/users/me/default-workspace`이고 값도 유저당 하나다. 그래서 자리가 여기다.
 *
 * 워크스페이스 설정(`workspace-settings-form.tsx`)에도 같은 명령을 부르는 카드가 있지만,
 * 그쪽은 `!isDefault`일 때만 뜬다 — 바꾸려는 워크스페이스로 먼저 이동해야 보이고,
 * 기본에 머무는 동안에는 화면 어디에도 이 설정이 없었다(APP-237).
 */
function DefaultWorkspaceSection() {
  const queryClient = useQueryClient();
  const response = useGetWorkspacesSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error("워크스페이스 목록을 불러오지 못했습니다.");
  }
  const workspaces = response.data.data.workspaces ?? [];
  const setDefault = useChangeDefaultWorkspace({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const pendingId = usePendingDefaultWorkspaceId();

  const makeDefault = async (workspaceId: string) => {
    try {
      await setDefault.mutateAsync({ data: { workspaceId } });
      // 이 명령은 **모든** 워크스페이스의 `isDefault`를 움직인다 — 옛 기본은 false가 된다.
      // 새 기본의 상세만 무효화하면 옛 기본의 상세 캐시에 `isDefault: true`가 남고,
      // 그 워크스페이스의 설정 > 일반은 계속 `기본` 배지를 그린다. 그 쿼리는
      // `WorkspaceAppShell`이 마운트해 두고 있어서 저절로 다시 받지도 않는다.
      //
      // 키가 `["/v1/workspaces/{id}"]` 한 칸이라 배열 접두사 매칭으로는 안 잡힌다.
      // 하위 경로(`/projects`·`/members`)까지 끌어오지 않도록 정확히 한 칸만 고른다.
      await queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          /^\/v1\/workspaces\/[^/]+$/.test(query.queryKey[0]),
      });
      toast.success("기본 워크스페이스로 설정했습니다.", {
        id: "account-default-workspace",
      });
    } catch (error) {
      // 목록이 오래돼 이미 나간 워크스페이스를 고르면 서버가 왜 안 되는지를 문구로 준다.
      // 여기서 고정 문구로 덮으면 그 이유가 사라진다.
      toast.error(
        errorMessageOf(error, "기본 워크스페이스를 변경하지 못했습니다."),
        { id: "account-default-workspace" }
      );
    } finally {
      // 목록은 성공·실패 어느 쪽이든 다시 받는다. 실패의 대표 원인이 **목록이 낡은 것**이라
      // (다른 세션에서 나갔거나 지워진 워크스페이스) 그대로 두면 없는 행과 버튼이 남고,
      // 전역 쿼리 클라이언트가 포커스 refetch를 꺼 두어 저절로 사라지지도 않는다.
      await queryClient.invalidateQueries({
        queryKey: getGetWorkspacesQueryKey(),
      });
    }
  };

  return (
    <section
      aria-labelledby="account-default-workspace-heading"
      className="rounded-panel border border-[var(--el-hairline)] bg-white p-6"
    >
      <h3
        id="account-default-workspace-heading"
        className="text-sm font-medium"
      >
        기본 워크스페이스
      </h3>
      <p className="mt-1 text-sm text-[var(--el-muted)]">
        로그인 후 가장 먼저 열 공간입니다.
      </p>
      <ul className="mt-4 space-y-2">
        {workspaces.map((workspace) => (
          <li
            key={workspace.workspaceId}
            className="flex items-center justify-between gap-4 rounded-block border border-[var(--el-hairline)] px-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm">{workspace.name}</span>
              {workspace.isDefault && <Badge>기본</Badge>}
            </span>
            {workspace.isDefault ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                loading={pendingId === workspace.workspaceId}
                // 다른 행이 도는 동안 두 번째 요청이 나가면 어느 쪽이 마지막인지 서버 순서에
                // 달린다 — 도는 동안은 형제 버튼도 함께 잠근다.
                disabled={pendingId !== null}
                onClick={() => void makeDefault(workspace.workspaceId)}
              >
                기본으로 설정
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 계정 설정 로딩 스켈레톤. settings-dialog가 DataBoundary fallback으로 쓴다. */
export function AccountSettingsFormSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8"
      aria-label="내 계정 설정 불러오는 중"
    >
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-24 rounded-panel" />
      <Skeleton className="h-20 rounded-panel" />
      <Skeleton className="h-44 rounded-panel" />
    </div>
  );
}
