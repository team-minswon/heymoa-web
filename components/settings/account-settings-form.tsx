"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    <div className="space-y-6" aria-label="내 계정 설정">
      <div>
        <h2 className="font-serif text-2xl font-light tracking-tight">
          내 계정
        </h2>
        <p className="mt-1 text-sm text-[var(--el-muted)]">
          프로필 정보를 확인합니다.
        </p>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--el-hairline)] bg-white p-5">
        <Avatar className="size-12">
          <AvatarFallback>{user?.name.slice(0, 1) ?? "나"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="account-email">이메일</Label>
          <Input id="account-email" value={user?.email ?? ""} disabled />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-name">이름</Label>
        <Input
          id="account-name"
          value={user?.name ?? ""}
          disabled
        />
      </div>
    </div>
  );
}
