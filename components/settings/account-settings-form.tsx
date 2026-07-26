"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetCurrentUserSuspense } from "@/lib/api/generated/users/users";

export function AccountSettingsForm() {
  const response = useGetCurrentUserSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error("계정 정보를 불러오지 못했습니다.");
  }
  const user = response.data.data;

  return (
    <div className="mx-auto max-w-2xl space-y-8" aria-label="내 계정 설정">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)]">
          Account
        </p>
        <h2 className="mt-2 font-serif text-3xl font-light tracking-[-0.025em]">
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
      <div className="space-y-2 rounded-2xl border border-[var(--el-hairline)] bg-white p-6">
        <Label htmlFor="account-name">이름</Label>
        <Input id="account-name" value={user.name} disabled />
      </div>
    </div>
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
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}
