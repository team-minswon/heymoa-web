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
    </div>
  );
}

/**
 * 계정 설정 로딩 스켈레톤. settings-dialog가 DataBoundary fallback으로 쓴다.
 *
 * **머리글은 가리지 않는다** — 제목과 설명은 응답이 아니라 고정 문구다. `h-9`(36) 막대로
 * 덮었을 때 실제 머리글 블록(68)보다 낮아 도착하는 순간 아래가 밀렸다.
 *
 * 카드는 둘이다. 셋째였던 기본 워크스페이스 카드(280)는 APP-401에서 사라졌다.
 */
export function AccountSettingsFormSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8"
      aria-label="내 계정 설정 불러오는 중"
    >
      <div>
        <h2 className="font-serif text-3xl font-light tracking-[-0.025em]">
          내 계정
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
          프로필 정보를 확인합니다.
        </p>
      </div>
      {/* 아바타 + 이메일 카드(106) · 이름 카드(104) */}
      <Skeleton className="h-[106px] rounded-panel" />
      <Skeleton className="h-[104px] rounded-panel" />
    </div>
  );
}
