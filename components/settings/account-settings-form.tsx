"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetCurrentUser } from "@/lib/api/generated/users/users";

export function AccountSettingsForm() {
  const query = useGetCurrentUser();
  const user =
    query.data?.status === 200 && query.data.data.success
      ? query.data.data.data
      : undefined;

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
      <div className="flex items-center gap-5 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
        <Avatar className="size-14">
          {user?.image ? (
            <AvatarImage src={user.image} alt={`${user.name} 프로필`} />
          ) : null}
          <AvatarFallback>{user?.name.slice(0, 1) ?? "나"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="account-email">이메일</Label>
          <Input id="account-email" value={user?.email ?? ""} disabled />
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-[var(--el-hairline)] bg-white p-6">
        <Label htmlFor="account-name">이름</Label>
        <Input id="account-name" value={user?.name ?? ""} disabled />
      </div>
    </div>
  );
}
